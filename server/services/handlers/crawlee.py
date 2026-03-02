"""Crawlee web scraping handler using the crawlee library.

Thin wrapper around Crawlee's BeautifulSoupCrawler and PlaywrightCrawler.
The library handles concurrency, retries, storage, and anti-bot internally.
"""

import asyncio
import time
from datetime import timedelta
from typing import Any, Dict, List, Optional

from core.logging import get_logger

logger = get_logger(__name__)

# Max content size per page to prevent memory issues
_MAX_CONTENT_LENGTH = 100_000


async def _get_proxy_config(parameters: Dict[str, Any], url: str):
    """Bridge MachinaOs ProxyService to Crawlee ProxyConfiguration.

    Returns a crawlee.ProxyConfiguration or None.
    """
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
    """Extract content from BeautifulSoup object."""
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
            pass  # Fall back to plain text

    return text[:_MAX_CONTENT_LENGTH]


def _extract_links(soup, base_url: str) -> List[str]:
    """Extract all links from page."""
    from urllib.parse import urljoin
    links = []
    for a in soup.find_all('a', href=True):
        links.append(urljoin(base_url, a['href']))
    return links


async def handle_crawlee_scraper(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Scrape web pages using Crawlee (BeautifulSoup or Playwright).

    Args:
        node_id: Node ID
        node_type: Node type ('crawleeScraper')
        parameters: Node parameters
        context: Execution context

    Returns:
        Dict with success status, scraped pages, and metadata
    """
    start_time = time.time()

    url = parameters.get('url', '').strip()
    if not url:
        return {
            "success": False,
            "error": "URL is required",
            "execution_time": time.time() - start_time
        }

    crawler_type = parameters.get('crawlerType', 'beautifulsoup')
    mode = parameters.get('mode', 'single')
    css_selector = parameters.get('cssSelector', '')
    extract_links = parameters.get('extractLinks', False)
    output_format = parameters.get('outputFormat', 'text')
    max_pages = parameters.get('maxPages', 10) if mode == 'crawl' else 1
    max_depth = parameters.get('maxDepth', 2) if mode == 'crawl' else 0
    max_concurrency = parameters.get('maxConcurrency', 5)
    timeout_secs = parameters.get('timeout', 60)

    # Collect results from crawler handlers
    pages: List[Dict[str, Any]] = []

    try:
        proxy_config = await _get_proxy_config(parameters, url)

        if crawler_type in ('beautifulsoup', 'adaptive'):
            await _run_beautifulsoup(
                url, pages, parameters, proxy_config,
                css_selector, extract_links, output_format,
                mode, max_pages, max_depth, max_concurrency, timeout_secs,
            )
        elif crawler_type == 'playwright':
            await _run_playwright(
                url, pages, parameters, proxy_config,
                css_selector, extract_links, output_format,
                mode, max_pages, max_depth, max_concurrency, timeout_secs,
            )
        else:
            return {
                "success": False,
                "error": f"Unknown crawler type: {crawler_type}",
                "execution_time": time.time() - start_time
            }

        logger.info(f"[Crawlee] Scraped {len(pages)} page(s) from {url}")

        return {
            "success": True,
            "result": {
                "pages": pages,
                "page_count": len(pages),
                "crawler_type": crawler_type,
                "mode": mode,
                "proxied": proxy_config is not None,
            },
            "execution_time": time.time() - start_time
        }

    except ImportError as e:
        msg = str(e)
        if 'playwright' in msg.lower():
            msg = ("Playwright not installed. Run: pip install 'crawlee[playwright]' && playwright install chromium")
        elif 'crawlee' in msg.lower():
            msg = ("Crawlee not installed. Run: pip install 'crawlee[beautifulsoup]'")
        return {
            "success": False,
            "error": msg,
            "execution_time": time.time() - start_time
        }
    except Exception as e:
        logger.error(f"[Crawlee] Error scraping {url}: {e}")
        return {
            "success": False,
            "error": str(e),
            "execution_time": time.time() - start_time
        }


async def _run_beautifulsoup(
    url: str,
    pages: List[Dict],
    parameters: Dict[str, Any],
    proxy_config,
    css_selector: str,
    extract_links: bool,
    output_format: str,
    mode: str,
    max_pages: int,
    max_depth: int,
    max_concurrency: int,
    timeout_secs: int,
) -> None:
    """Run BeautifulSoupCrawler and collect results into pages list."""
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

    link_selector = parameters.get('linkSelector', '') or 'a[href]'
    url_pattern = parameters.get('urlPattern', '')

    @crawler.router.default_handler
    async def handler(ctx: BeautifulSoupCrawlingContext) -> None:
        title = ctx.soup.title.string if ctx.soup.title else ''
        content = _extract_text(ctx.soup, css_selector, output_format)

        page_data: Dict[str, Any] = {
            'url': ctx.request.url,
            'title': title,
            'content': content,
        }
        if extract_links:
            page_data['links'] = _extract_links(ctx.soup, ctx.request.url)

        pages.append(page_data)

        # Follow links in crawl mode
        if mode == 'crawl':
            enqueue_kwargs: Dict[str, Any] = {'selector': link_selector}
            if url_pattern:
                import re
                from fnmatch import translate
                pattern = re.compile(translate(url_pattern))
                enqueue_kwargs['include'] = [pattern]
            await ctx.enqueue_links(**enqueue_kwargs)

    await asyncio.wait_for(
        crawler.run([url]),
        timeout=timeout_secs,
    )


async def _run_playwright(
    url: str,
    pages: List[Dict],
    parameters: Dict[str, Any],
    proxy_config,
    css_selector: str,
    extract_links: bool,
    output_format: str,
    mode: str,
    max_pages: int,
    max_depth: int,
    max_concurrency: int,
    timeout_secs: int,
) -> None:
    """Run PlaywrightCrawler and collect results into pages list."""
    from crawlee import ConcurrencySettings
    from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
    from crawlee.storage_clients import MemoryStorageClient

    browser_type = parameters.get('browserType', 'chromium')
    wait_for_selector = parameters.get('waitForSelector', '')
    wait_timeout = parameters.get('waitTimeout', 30000)
    take_screenshot = parameters.get('screenshot', False)

    crawler = PlaywrightCrawler(
        browser_type=browser_type,
        headless=True,
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

    link_selector = parameters.get('linkSelector', '') or 'a[href]'
    url_pattern = parameters.get('urlPattern', '')

    @crawler.router.default_handler
    async def handler(ctx: PlaywrightCrawlingContext) -> None:
        page = ctx.page

        # Wait for specific element if configured
        if wait_for_selector:
            await page.wait_for_selector(wait_for_selector, timeout=wait_timeout)

        title = await page.title()

        # Get page content for extraction
        html = await page.content()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        content = _extract_text(soup, css_selector, output_format)

        page_data: Dict[str, Any] = {
            'url': ctx.request.url,
            'title': title,
            'content': content,
        }
        if extract_links:
            page_data['links'] = _extract_links(soup, ctx.request.url)
        if take_screenshot:
            screenshot_bytes = await page.screenshot(type='png')
            import base64
            page_data['screenshot'] = base64.b64encode(screenshot_bytes).decode()

        pages.append(page_data)

        # Follow links in crawl mode
        if mode == 'crawl':
            enqueue_kwargs: Dict[str, Any] = {'selector': link_selector}
            if url_pattern:
                import re
                from fnmatch import translate
                pattern = re.compile(translate(url_pattern))
                enqueue_kwargs['include'] = [pattern]
            await ctx.enqueue_links(**enqueue_kwargs)

    await asyncio.wait_for(
        crawler.run([url]),
        timeout=timeout_secs,
    )
