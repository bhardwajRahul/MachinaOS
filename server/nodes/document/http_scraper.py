"""HTTP Scraper — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._helpers import delegate


class HttpScraperParams(BaseModel):
    url: str = Field(default="")
    pagination_mode: str = Field(default="single", alias="paginationMode")
    max_pages: int = Field(default=10, alias="maxPages", ge=1, le=1000)
    use_proxy: bool = Field(default=False, alias="useProxy")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class HttpScraperOutput(BaseModel):
    items: Optional[list] = None
    count: Optional[int] = None

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
    async def scrape(self, ctx: NodeContext, params: HttpScraperParams) -> Any:
        from services.handlers.document import handle_http_scraper
        return await delegate(
            handle_http_scraper, node_type=self.type, node_id=ctx.node_id,
            payload=params.model_dump(by_alias=True), context=ctx.raw,
        )
