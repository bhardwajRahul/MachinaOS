"""HTTP Scraper — Wave 11.D.7 inlined.

Scrapes links from web pages with optional date/page pagination.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, ConfigDict, Field

from core.logging import get_logger
from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

logger = get_logger(__name__)


class HttpScraperParams(BaseModel):
    url: str = Field(default="")
    pagination_mode: str = Field(default="single", alias="paginationMode")
    max_pages: int = Field(default=10, alias="maxPages", ge=1, le=1000)
    use_proxy: bool = Field(default=False, alias="useProxy")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class HttpScraperOutput(BaseModel):
    items: Optional[list] = None
    item_count: Optional[int] = None
    errors: Optional[list] = None

    model_config = ConfigDict(extra="allow")


class HttpScraperNode(ActionNode):
    type = "httpScraper"
    display_name = "HTTP Scraper"
    subtitle = "Page Pagination"
    icon = "🔍"
    color = "#bd93f9"
    group = ("document",)
    description = "Scrape links from web pages with date/page pagination support"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.REST_API

    Params = HttpScraperParams
    Output = HttpScraperOutput

    @Operation("scrape")
    async def scrape(self, ctx: NodeContext, params: HttpScraperParams) -> HttpScraperOutput:
        p = params.model_dump(by_alias=True)
        url = p.get('url', '')
        if not url:
            raise RuntimeError("URL is required")

        iteration_mode = p.get('iterationMode') or p.get('paginationMode', 'single')
        link_selector = p.get('linkSelector', 'a[href$=".pdf"]')
        headers_str = p.get('headers', '{}')
        headers = json.loads(headers_str) if isinstance(headers_str, str) and headers_str else {}

        urls_to_fetch = []
        if iteration_mode == 'date':
            start_date = p.get('startDate', '')
            end_date = p.get('endDate', '')
            placeholder = p.get('datePlaceholder', '{date}')
            if not start_date or not end_date:
                raise RuntimeError("Start/end dates required for date mode")
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
            current = start
            while current <= end:
                urls_to_fetch.append((
                    url.replace(placeholder, current.strftime("%Y-%m-%d")),
                    {'date': current.isoformat()},
                ))
                current += timedelta(days=1)
        elif iteration_mode == 'page':
            start_page = int(p.get('startPage', 1))
            end_page = int(p.get('endPage', 10))
            for page in range(start_page, end_page + 1):
                urls_to_fetch.append((url.replace('{page}', str(page)), {'page': page}))
        else:
            urls_to_fetch.append((url, {}))

        proxy_url = None
        if p.get('useProxy', False):
            try:
                from services.proxy.service import get_proxy_service
                proxy_svc = get_proxy_service()
                if proxy_svc and proxy_svc.is_enabled():
                    proxy_url = await proxy_svc.get_proxy_url(url, p)
            except Exception as e:
                logger.warning("[httpScraper] Proxy lookup failed", error=str(e))

        items, errors = [], []
        client_kwargs: dict = {"timeout": 30, "follow_redirects": True}
        if proxy_url:
            client_kwargs["proxy"] = proxy_url

        async with httpx.AsyncClient(**client_kwargs) as client:
            for fetch_url, meta in urls_to_fetch:
                try:
                    response = await client.get(fetch_url, headers=headers)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, 'html.parser')
                    for el in soup.select(link_selector):
                        href = el.get('href', '')
                        if href:
                            items.append({
                                'url': urljoin(fetch_url, href),
                                'text': el.get_text(strip=True),
                                'source_url': fetch_url,
                                **meta,
                            })
                except Exception as e:
                    errors.append(f"{fetch_url}: {e}")

        return HttpScraperOutput(items=items, item_count=len(items), errors=errors)
