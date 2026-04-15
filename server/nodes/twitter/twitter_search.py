"""Twitter Search — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class TwitterSearchParams(BaseModel):
    query: str = Field(..., min_length=1)
    max_results: int = Field(default=10, alias="maxResults", ge=10, le=100)

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class TwitterSearchOutput(BaseModel):
    tweets: Optional[list] = None
    count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class TwitterSearchNode(ActionNode):
    type = "twitterSearch"
    display_name = "Twitter Search"
    subtitle = "Search Tweets"
    icon = "asset:x"
    color = "#1DA1F2"
    group = ("social", "tool")
    description = "Search recent tweets on Twitter/X using the Search API"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = TwitterSearchParams
    Output = TwitterSearchOutput

    @Operation("search", cost={"service": "twitter", "action": "search", "count": 1})
    async def search(self, ctx: NodeContext, params: TwitterSearchParams) -> Any:
        from services.handlers.twitter import handle_twitter_search
        response = await handle_twitter_search(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Twitter search failed")
