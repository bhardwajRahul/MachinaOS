# Crawlee Scraper (`crawleeScraper`)

| Field | Value |
|------|-------|
| **Category** | web_automation / tool (dual-purpose) |
| **Backend handler** | [`server/services/handlers/crawlee.py::handle_crawlee_scraper`](../../../server/services/handlers/crawlee.py) |
| **Tests** | [`server/tests/nodes/test_web_automation.py`](../../../server/tests/nodes/test_web_automation.py) |
| **Skill (if any)** | [`server/skills/web_agent/crawlee-scraper-skill/SKILL.md`](../../../server/skills/web_agent/crawlee-scraper-skill/SKILL.md) |
| **Dual-purpose tool** | yes |

## Purpose

Python-based web scraping on top of the `crawlee` library. Supports two runtime
engines:

- `beautifulsoup` - fast static HTML scraping via `BeautifulSoupCrawler`.
- `playwright` - full headless browser for JS-rendered pages via `PlaywrightCrawler`.
- `adaptive` - currently aliased to `beautifulsoup` in this handler.

Two modes control how many URLs are visited: `single` (only the seed URL, hard
caps `max_pages=1` / `max_depth=0`) and `crawl` (follow links matching
`linkSelector` + optional `urlPattern` up to `maxPages` / `maxDepth`).

Unlike `httpRequest` or `browser`, Crawlee manages concurrency, retry
back-off, request queues, and storage internally; the handler only feeds in
config and collects a page list from the route handler closure.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream trigger; not consumed directly |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `url` | string | `""` | **yes** | - | Seed URL |
| `crawlerType` | options | `beautifulsoup` | no | - | `beautifulsoup` / `playwright` / `adaptive` |
| `mode` | options | `single` | no | - | `single` or `crawl` |
| `cssSelector` | string | `""` | no | - | CSS selector used for text/HTML extraction. Empty -> whole page |
| `extractLinks` | boolean | `false` | no | - | Include `links[]` on each page |
| `outputFormat` | options | `text` | no | - | `text` / `html` / `markdown`. `markdown` falls back to text if `html2text` not installed |
| `maxPages` | number | `10` | no | `mode=crawl` | Ignored and clamped to 1 when `mode=single` |
| `maxDepth` | number | `2` | no | `mode=crawl` | Ignored and set to 0 when `mode=single` |
| `maxConcurrency` | number | `5` | no | - | Forwarded as `max_concurrency`; `desired_concurrency = min(maxConcurrency, 10)` |
| `timeout` | number | `60` | no | - | Per-request handler timeout AND outer `asyncio.wait_for` timeout |
| `linkSelector` | string | `""` | no | `mode=crawl` | Defaults to `a[href]` when empty |
| `urlPattern` | string | `""` | no | `mode=crawl` | `fnmatch`-style pattern compiled with `fnmatch.translate` -> passed to `enqueue_links(include=[regex])` |
| `browserType` | options | `chromium` | no | `crawlerType=playwright` | `chromium` / `firefox` / `webkit` |
| `waitForSelector` | string | `""` | no | `crawlerType=playwright` | Awaits selector before extracting |
| `waitTimeout` | number | `30000` | no | `crawlerType=playwright` | Milliseconds for `wait_for_selector` |
| `screenshot` | boolean | `false` | no | `crawlerType=playwright` | Capture base64 PNG per page |
| `useProxy` | boolean | `false` | no | - | Route through `ProxyService` (see Decision Logic) |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Standard envelope payload |

### Output payload

```ts
{
  pages: Array<{
    url: string;
    title: string;
    content: string;
    links?: string[];        // when extractLinks=true
    screenshot?: string;     // base64 PNG, playwright + screenshot=true
  }>;
  page_count: number;
  crawler_type: 'beautifulsoup' | 'playwright' | 'adaptive';
  mode: 'single' | 'crawl';
  proxied: boolean;
}
```

## Logic Flow

```mermaid
flowchart TD
  A[handle_crawlee_scraper] --> B{url stripped<br/>non-empty?}
  B -- no --> Eurl[Return error: URL is required]
  B -- yes --> C[Read crawlerType, mode, cssSelector,<br/>extractLinks, outputFormat, maxPages,<br/>maxDepth, maxConcurrency, timeout]
  C --> C1{mode == 'single'?}
  C1 -- yes --> C2[Force maxPages=1, maxDepth=0]
  C1 -- no --> C3[Use provided max_pages / max_depth]
  C2 & C3 --> D[await _get_proxy_config parameters, url]
  D --> D1{useProxy AND<br/>ProxyService.get_proxy_url<br/>returned URL?}
  D1 -- yes --> D2[ProxyConfiguration proxy_urls=url]
  D1 -- no / exception --> D3[proxy_config = None]
  D2 & D3 --> E{crawlerType?}
  E -- beautifulsoup / adaptive --> F1[_run_beautifulsoup]
  E -- playwright --> F2[_run_playwright]
  E -- other --> Ebad[Return error:<br/>Unknown crawler type]
  F1 --> G[BeautifulSoupCrawler<br/>max_requests_per_crawl=maxPages<br/>max_crawl_depth=maxDepth if crawl else 0<br/>request_handler_timeout=timeout<br/>ConcurrencySettings<br/>MemoryStorageClient<br/>proxy_configuration=proxy_config]
  F2 --> H[PlaywrightCrawler<br/>browser_type, headless=True, proxy_configuration]
  G & H --> I[register default_handler closure]
  I --> I1[handler: extract title/content<br/>via _extract_text+_extract_links<br/>append to pages list<br/>if mode=crawl: ctx.enqueue_links<br/>with optional fnmatch-compiled include regex]
  I1 --> J[asyncio.wait_for crawler.run URL, timeout=timeout]
  J -- ImportError --> Eimp[Return error with install hint<br/>playwright vs crawlee]
  J -- other Exception --> Egen[Return error: str e]
  J -- ok --> K[Return success<br/>pages, page_count, crawler_type, mode, proxied]
```

## Decision Logic

- **Empty URL**: `url.strip() == ""` -> immediate failure envelope, no crawler
  is constructed.
- **`mode='single'`**: hard clamps `max_pages=1` and `max_depth=0`, regardless
  of what the user set. In `crawl` mode the requested values are forwarded.
- **`crawlerType='adaptive'`**: routed to `_run_beautifulsoup` - there is no
  true adaptive detection in this handler today.
- **Proxy bridge**: `_get_proxy_config` only runs when `useProxy=True`.
  `ProxyService.get_proxy_url` returning `None` or raising any `Exception` is
  logged at WARN and the crawl proceeds unproxied.
- **Link filter**: when `urlPattern` is set in `crawl` mode the pattern is
  passed through `fnmatch.translate` and compiled to a regex for
  `enqueue_links(include=[...])`.
- **Content extraction**: `_extract_text` returns text, html, or markdown.
  For markdown the handler falls back to plain text if `html2text` is missing
  (`ImportError` swallowed). All output is capped at 100 000 chars
  (`_MAX_CONTENT_LENGTH`).
- **Error handling**:
  - `ImportError` whose message contains `playwright` -> rewritten to an
    install hint for `pip install 'crawlee[playwright]' && playwright install`.
  - `ImportError` whose message contains `crawlee` -> rewritten to an install
    hint for `pip install 'crawlee[beautifulsoup]'`.
  - All other exceptions are caught and the `str(e)` returned as-is; the
    handler never raises.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none.
- **External API calls**: HTTP(S) requests to the target site(s), optionally
  via a proxy returned by `ProxyService`.
- **File I/O**: none by default. `MemoryStorageClient` keeps the request queue
  in memory only.
- **Subprocess**: PlaywrightCrawler launches a browser subprocess under the
  hood (managed by Playwright), but this handler does not spawn anything
  directly.

## External Dependencies

- **Credentials**: none directly. Proxy auth, if any, is embedded in the
  proxy URL returned by `ProxyService.get_proxy_url`.
- **Services**: `ProxyService` (only when `useProxy=True`).
- **Python packages**: `crawlee[beautifulsoup]`, `crawlee[playwright]`
  (optional), `bs4`, `html2text` (optional, for markdown), `playwright` (for
  playwright mode).
- **Environment variables**: none.

## Edge cases & known limits

- **Content truncation**: per-page content is silently capped at 100 KB by
  `_MAX_CONTENT_LENGTH` - longer pages are truncated without a marker.
- **Single mode ignores user caps**: `maxPages` and `maxDepth` are
  overridden to 1 and 0 respectively when `mode=single`.
- **`adaptive` is a lie**: currently aliased to `beautifulsoup`; there is no
  runtime detection to escalate to Playwright for JS-heavy pages.
- **Markdown silently downgrades to text** if `html2text` is not installed.
- **Timeout is applied twice**: once as `request_handler_timeout` inside the
  crawler and again as `asyncio.wait_for(crawler.run(...), timeout=timeout)`
  wrapping the whole run. Long multi-page crawls hit the outer limit first.
- **Proxy failures are swallowed**: any exception from `ProxyService` causes
  the crawl to proceed UN-proxied and returns `proxied=False`, which may leak
  the user's real IP to the target.
- **No usage tracking**: unlike `proxyRequest` / `httpRequest`, this handler
  does not record cost or bytes metrics.

## Related

- **Skills using this as a tool**: [`crawlee-scraper-skill/SKILL.md`](../../../server/skills/web_agent/crawlee-scraper-skill/SKILL.md)
- **Companion nodes**: [`browser`](./browser.md), [`apifyActor`](./apifyActor.md),
  [`httpRequest`](../http_proxy/httpRequest.md)
- **Architecture docs**: [Proxy Service](../../proxy_service.md)
