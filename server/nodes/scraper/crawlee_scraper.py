"""Crawlee Scraper — Wave 11.D.8 inlined.

Thin wrapper over ``crawlee.BeautifulSoupCrawler`` (static HTML) and
``crawlee.PlaywrightCrawler`` (JS-rendered). Crawlee handles concurrency,
retries, storage, and anti-bot internally.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import urljoin

from pydantic import BaseModel, ConfigDict, Field

from core.logging import get_logger
from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

logger = get_logger(__name__)

_MAX_CONTENT_LENGTH = 100_000


async def _get_proxy_config(parameters: Dict[str, Any], url: str):
    """Bridge MachinaOs ProxyService to Crawlee ProxyConfiguration."""
    if not parameters.get('useProxy', False):
        return None
    try:
        from services.proxy import get_proxy_service
        proxy_svc = get_proxy_service()
        proxy_url = await proxy_svc.get_proxy_url(url, parameters)
        if not proxy_url:
            return None
        from crawlee.proxy_configuration import ProxyConfiguration
        return ProxyConfiguration(proxy_urls=[proxy_url])
    except Exception as e:
        logger.warning(f"[Crawlee] Proxy setup failed, proceeding without: {e}")
        return None


def _extract_text(soup, css_selector: str, output_format: str) -> str:
    target = soup.select(css_selector) if css_selector else [soup]
    if output_format == 'html':
        parts = [str(el) for el in target]
    else:
        parts = [el.get_text(separator='\n', strip=True) for el in target]
    text = '\n\n'.join(parts)
    if output_format == 'markdown':
        try:
            import html2text
            h = html2text.HTML2Text()
            h.ignore_links = False
            h.ignore_images = False
            h.body_width = 0
            raw_html = '\n\n'.join(str(el) for el in target)
            text = h.handle(raw_html)
        except ImportError:
            pass
    return text[:_MAX_CONTENT_LENGTH]


def _extract_links(soup, base_url: str) -> List[str]:
    return [urljoin(base_url, a['href']) for a in soup.find_all('a', href=True)]


async def _run_beautifulsoup(url, pages, p, proxy_config, css_selector, extract_links,
                             output_format, mode, max_pages, max_depth,
                             max_concurrency, timeout_secs):
    from crawlee import ConcurrencySettings
    from crawlee.crawlers import BeautifulSoupCrawler, BeautifulSoupCrawlingContext
    from crawlee.storage_clients import MemoryStorageClient

    crawler = BeautifulSoupCrawler(
        max_requests_per_crawl=max_pages,
        max_crawl_depth=max_depth if mode == 'crawl' else 0,
        request_handler_timeout=timedelta(seconds=timeout_secs),
        concurrency_settings=ConcurrencySettings(
            max_concurrency=max_concurrency,
            desired_concurrency=min(max_concurrency, 10),
        ),
        storage_client=MemoryStorageClient(),
        proxy_configuration=proxy_config,
        configure_logging=False,
    )
    link_selector = p.get('linkSelector', '') or 'a[href]'
    url_pattern = p.get('urlPattern', '')

    @crawler.router.default_handler
    async def handler(ctx: BeautifulSoupCrawlingContext) -> None:
        title = ctx.soup.title.string if ctx.soup.title else ''
        content = _extract_text(ctx.soup, css_selector, output_format)
        page_data: Dict[str, Any] = {
            'url': ctx.request.url, 'title': title, 'content': content,
        }
        if extract_links:
            page_data['links'] = _extract_links(ctx.soup, ctx.request.url)
        pages.append(page_data)

        if mode == 'crawl':
            kwargs: Dict[str, Any] = {'selector': link_selector}
            if url_pattern:
                import re
                from fnmatch import translate
                kwargs['include'] = [re.compile(translate(url_pattern))]
            await ctx.enqueue_links(**kwargs)

    await asyncio.wait_for(crawler.run([url]), timeout=timeout_secs)


async def _run_playwright(url, pages, p, proxy_config, css_selector, extract_links,
                          output_format, mode, max_pages, max_depth,
                          max_concurrency, timeout_secs):
    from crawlee import ConcurrencySettings
    from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
    from crawlee.storage_clients import MemoryStorageClient

    browser_type = p.get('browserType', 'chromium')
    wait_for_selector = p.get('waitForSelector', '')
    wait_timeout = p.get('waitTimeout', 30000)
    take_screenshot = p.get('screenshot', False) or p.get('takeScreenshot', False)

    crawler = PlaywrightCrawler(
        browser_type=browser_type, headless=True,
        max_requests_per_crawl=max_pages,
        max_crawl_depth=max_depth if mode == 'crawl' else 0,
        request_handler_timeout=timedelta(seconds=timeout_secs),
        concurrency_settings=ConcurrencySettings(
            max_concurrency=max_concurrency,
            desired_concurrency=min(max_concurrency, 10),
        ),
        storage_client=MemoryStorageClient(),
        proxy_configuration=proxy_config,
        configure_logging=False,
    )
    link_selector = p.get('linkSelector', '') or 'a[href]'
    url_pattern = p.get('urlPattern', '')

    @crawler.router.default_handler
    async def handler(ctx: PlaywrightCrawlingContext) -> None:
        page = ctx.page
        if wait_for_selector:
            await page.wait_for_selector(wait_for_selector, timeout=wait_timeout)
        title = await page.title()
        html = await page.content()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        content = _extract_text(soup, css_selector, output_format)
        page_data: Dict[str, Any] = {
            'url': ctx.request.url, 'title': title, 'content': content,
        }
        if extract_links:
            page_data['links'] = _extract_links(soup, ctx.request.url)
        if take_screenshot:
            import base64
            screenshot_bytes = await page.screenshot(type='png')
            page_data['screenshot'] = base64.b64encode(screenshot_bytes).decode()
        pages.append(page_data)

        if mode == 'crawl':
            kwargs: Dict[str, Any] = {'selector': link_selector}
            if url_pattern:
                import re
                from fnmatch import translate
                kwargs['include'] = [re.compile(translate(url_pattern))]
            await ctx.enqueue_links(**kwargs)

    await asyncio.wait_for(crawler.run([url]), timeout=timeout_secs)


class CrawleeScraperParams(BaseModel):
    url: str = Field(default="")
    crawler_type: Literal["beautifulsoup", "playwright", "adaptive"] = Field(
        default="beautifulsoup", alias="crawlerType",
    )
    mode: Literal["single", "crawl"] = "single"
    css_selector: str = Field(default="", alias="cssSelector")
    extract_links: bool = Field(default=False, alias="extractLinks")
    max_pages: int = Field(default=10, alias="maxPages", ge=1, le=1000)
    take_screenshot: bool = Field(default=False, alias="takeScreenshot")
    output_format: Literal["text", "html", "markdown"] = Field(
        default="text", alias="outputFormat",
    )

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class CrawleeScraperOutput(BaseModel):
    pages: Optional[list] = None
    page_count: Optional[int] = None
    crawler_type: Optional[str] = None
    mode: Optional[str] = None
    proxied: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class CrawleeScraperNode(ActionNode):
    type = "crawleeScraper"
    display_name = "Web Scraper"
    subtitle = "Crawlee"
    icon = "🕷"
    color = "#ff79c6"
    group = ("scraper", "tool")
    description = "Web scraper supporting static HTML (BeautifulSoup) and JS-rendered (Playwright)"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.BROWSER
    usable_as_tool = True

    Params = CrawleeScraperParams
    Output = CrawleeScraperOutput

    @Operation("scrape")
    async def scrape(self, ctx: NodeContext, params: CrawleeScraperParams) -> CrawleeScraperOutput:
        p = params.model_dump(by_alias=True)
        url = p.get('url', '').strip()
        if not url:
            raise RuntimeError("URL is required")

        crawler_type = p.get('crawlerType', 'beautifulsoup')
        mode = p.get('mode', 'single')
        css_selector = p.get('cssSelector', '')
        extract_links = p.get('extractLinks', False)
        output_format = p.get('outputFormat', 'text')
        max_pages = p.get('maxPages', 10) if mode == 'crawl' else 1
        max_depth = p.get('maxDepth', 2) if mode == 'crawl' else 0
        max_concurrency = p.get('maxConcurrency', 5)
        timeout_secs = p.get('timeout', 60)

        pages: List[Dict[str, Any]] = []
        proxy_config = await _get_proxy_config(p, url)

        try:
            if crawler_type in ('beautifulsoup', 'adaptive'):
                await _run_beautifulsoup(
                    url, pages, p, proxy_config, css_selector, extract_links,
                    output_format, mode, max_pages, max_depth,
                    max_concurrency, timeout_secs,
                )
            elif crawler_type == 'playwright':
                await _run_playwright(
                    url, pages, p, proxy_config, css_selector, extract_links,
                    output_format, mode, max_pages, max_depth,
                    max_concurrency, timeout_secs,
                )
            else:
                raise RuntimeError(f"Unknown crawler type: {crawler_type}")
        except ImportError as e:
            msg = str(e).lower()
            if 'playwright' in msg:
                raise RuntimeError(
                    "Playwright not installed. Run: "
                    "pip install 'crawlee[playwright]' && playwright install chromium",
                )
            if 'crawlee' in msg:
                raise RuntimeError(
                    "Crawlee not installed. Run: pip install 'crawlee[beautifulsoup]'",
                )
            raise

        logger.info(f"[Crawlee] Scraped {len(pages)} page(s) from {url}")
        return CrawleeScraperOutput(
            pages=pages, page_count=len(pages),
            crawler_type=crawler_type, mode=mode, proxied=proxy_config is not None,
        )
