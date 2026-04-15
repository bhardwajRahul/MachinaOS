"""Crawlee Scraper — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class CrawleeScraperParams(BaseModel):
    url: str = Field(...)
    crawler_type: Literal["beautifulsoup", "playwright", "adaptive"] = Field(
        default="beautifulsoup", alias="crawlerType",
    )
    mode: Literal["single", "crawl"] = "single"
    css_selector: str = Field(default="", alias="cssSelector")
    extract_links: bool = Field(default=False, alias="extractLinks")
    max_pages: int = Field(default=10, alias="maxPages", ge=1, le=1000)
    take_screenshot: bool = Field(default=False, alias="takeScreenshot")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class CrawleeScraperOutput(BaseModel):
    items: Optional[list] = None
    pages_crawled: Optional[int] = None

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
    async def scrape(self, ctx: NodeContext, params: CrawleeScraperParams) -> Any:
        from services.handlers.crawlee import handle_crawlee_scraper
        response = await handle_crawlee_scraper(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Crawlee scrape failed")
