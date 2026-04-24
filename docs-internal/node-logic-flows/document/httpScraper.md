# HTTP Scraper (`httpScraper`)

| Field | Value |
|------|-------|
| **Category** | document |
| **Backend handler** | [`server/services/handlers/document.py::handle_http_scraper`](../../../server/services/handlers/document.py) |
| **Tests** | [`server/tests/nodes/test_document.py`](../../../server/tests/nodes/test_document.py) |
| **Skill (if any)** | none |
| **Dual-purpose tool** | no |

## Purpose

Scrape links from one or more web pages into a normalized `items[]` array
suitable for the `fileDownloader` node. Supports three iteration modes:
single URL, date-range iteration with a `{date}` placeholder, and page
pagination with a `{page}` placeholder. A CSS selector picks which anchor-like
elements become items. Typically the first stage of an ingestion pipeline:
`httpScraper -> fileDownloader -> documentParser -> textChunker -> ...`.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Trigger / upstream data; not consumed directly |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `url` | string | `""` | **yes** | - | URL with optional `{date}` / `{page}` placeholder |
| `iterationMode` | options | `single` | no | - | `single` / `date` / `page` |
| `startDate` | string | `""` | yes (date mode) | `iterationMode=date` | `YYYY-MM-DD` |
| `endDate` | string | `""` | yes (date mode) | `iterationMode=date` | `YYYY-MM-DD`, inclusive |
| `datePlaceholder` | string | `{date}` | no | `iterationMode=date` | Substring replaced with formatted date |
| `startPage` | number | `1` | no | `iterationMode=page` | Inclusive |
| `endPage` | number | `10` | no | `iterationMode=page` | Inclusive; `{page}` literal replaced |
| `linkSelector` | string | `a[href$=".pdf"]` | no | - | BeautifulSoup CSS selector |
| `headers` | string (JSON) | `{}` | no | - | Extra HTTP headers as JSON object |
| `useProxy` | boolean | `false` | no | - | Route through proxy service if enabled |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | `items`, `item_count`, `errors` |

### Output payload

```ts
{
  items: Array<{
    url: string;          // urljoin(fetch_url, href)
    text: string;         // anchor text, stripped
    source_url: string;   // page the link was found on
    date?: string;        // ISO date, present in date mode
    page?: number;        // present in page mode
  }>;
  item_count: number;
  errors: string[];       // "<url>: <error str>" per failed fetch
}
```

Wrapped in standard envelope: `{ success, result, execution_time, node_id, node_type, timestamp }`.

## Logic Flow

```mermaid
flowchart TD
  A[handle_http_scraper] --> B{url provided?}
  B -- no --> Eret[Return success=false<br/>error: URL is required]
  B -- yes --> C[Parse headers JSON]
  C --> D{iterationMode}
  D -- date --> D1[Iterate start_date..end_date days<br/>replace datePlaceholder per URL]
  D -- page --> D2[Iterate startPage..endPage<br/>replace `{page}` literal per URL]
  D -- single --> D3[Single URL, meta=`{}`]
  D1 --> E[Build urls_to_fetch list]
  D2 --> E
  D3 --> E
  E --> F{useProxy?}
  F -- yes --> F1[Lookup proxy URL via proxy_service<br/>swallow errors, continue without proxy]
  F -- no --> G[httpx.AsyncClient timeout=30 follow_redirects=True]
  F1 --> G
  G --> H[For each URL: GET + BeautifulSoup parse]
  H -- HTTPStatusError / Exception --> I[Append to errors, keep going]
  H -- ok --> J[Select by linkSelector, build item dict with urljoin + meta]
  I --> K[Return success=true with items/errors]
  J --> K
```

## Decision Logic

- **Validation**: missing `url` raises `ValueError("URL is required")`; caught by outer `except` -> `success=false`.
- **Date mode**: missing `startDate` or `endDate` raises `ValueError` -> `success=false`.
- **Iteration mode fallback**: any value other than `date` or `page` takes the single-URL branch (no validation of unknown modes).
- **Per-URL errors**: collected into `errors` list; the handler still returns `success=true` even if every URL failed (only top-level setup errors fail the envelope).
- **Proxy failure**: logged at warning, request proceeds without proxy.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none.
- **External API calls**: `GET <fetch_url>` for each expanded URL, timeout 30s, `follow_redirects=True`.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: none.
- **Services**: optional `services.proxy.service.get_proxy_service()` when `useProxy=true`.
- **Python packages**: `httpx`, `beautifulsoup4`.
- **Environment variables**: none.

## Edge cases & known limits

- `datePlaceholder` is a plain `str.replace`, not a token boundary - a URL containing the placeholder substring twice is replaced twice.
- Date mode formats dates as `YYYY-MM-DD`; placeholder in URL is replaced with this exact format regardless of what the user wrote.
- `{page}` in page mode is hard-coded, not configurable (unlike the date placeholder).
- `headers` is parsed with `json.loads` with no try/except - invalid JSON raises at the top level and fails the envelope.
- Per-URL failures are silently aggregated into `errors` but the envelope is still `success=true`; downstream nodes must check `errors`.
- `endPage`/`endDate` are inclusive.

## Related

- **Skills using this as a tool**: none (not a dual-purpose tool).
- **Downstream nodes**: [`fileDownloader`](./fileDownloader.md) consumes the `items` array directly.
- **Architecture docs**: [Proxy Service](../../proxy_service.md).
