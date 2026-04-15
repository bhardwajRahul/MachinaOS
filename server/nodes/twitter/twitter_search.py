"""Twitter Search — Wave 11.D.8 inlined."""

from __future__ import annotations

import asyncio
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from credentials.twitter import TwitterCredential

from ._base import (
    call_with_retry, format_tweet, includes_lookups,
    sync_search_recent, track_twitter_usage,
)


class TwitterSearchParams(BaseModel):
    query: str = Field(default="", min_length=0)
    max_results: int = Field(default=10, alias="maxResults", ge=10, le=100)

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class TwitterSearchOutput(BaseModel):
    tweets: Optional[list] = None
    count: Optional[int] = None
    query: Optional[str] = None

    model_config = ConfigDict(extra="allow")


async def _do_search(client, query: str, max_results: int, node_id: str, ctx_raw: dict) -> TwitterSearchOutput:
    search = await asyncio.to_thread(sync_search_recent, client, query, max_results)
    users_by_id, media_by_key, tweets_by_id = includes_lookups(search["includes"])
    tweets = [format_tweet(t, users_by_id, media_by_key, tweets_by_id) for t in search["tweets"]]
    if tweets:
        await track_twitter_usage(node_id, "search", len(tweets), ctx_raw)
    return TwitterSearchOutput(tweets=tweets, count=len(tweets), query=query)


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
    credentials = (TwitterCredential,)
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = TwitterSearchParams
    Output = TwitterSearchOutput

    @Operation("search", cost={"service": "twitter", "action": "search", "count": 1})
    async def search(self, ctx: NodeContext, params: TwitterSearchParams) -> TwitterSearchOutput:
        if not params.query:
            raise RuntimeError("Search query is required")
        max_results = max(10, min(params.max_results, 100))
        return await call_with_retry(_do_search, params.query, max_results, ctx.node_id, ctx.raw)
