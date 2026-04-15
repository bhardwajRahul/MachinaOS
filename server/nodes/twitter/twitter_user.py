"""Twitter User — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class TwitterUserParams(BaseModel):
    operation: Literal["me", "by_username", "by_id", "followers", "following"] = "me"
    username: str = Field(default="")
    user_id: str = Field(default="", alias="userId")
    max_results: int = Field(default=100, alias="maxResults", ge=1, le=1000)

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class TwitterUserOutput(BaseModel):
    user: Optional[dict] = None
    users: Optional[list] = None

    model_config = ConfigDict(extra="allow")


class TwitterUserNode(ActionNode):
    type = "twitterUser"
    display_name = "Twitter User"
    subtitle = "User Profiles"
    icon = "asset:x"
    color = "#1DA1F2"
    group = ("social", "tool")
    description = "Look up Twitter/X user profiles, followers, and following"
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

    Params = TwitterUserParams
    Output = TwitterUserOutput

    @Operation("lookup", cost={"service": "twitter", "action": "user_lookup", "count": 1})
    async def lookup(self, ctx: NodeContext, params: TwitterUserParams) -> Any:
        from services.handlers.twitter import handle_twitter_user
        response = await handle_twitter_user(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Twitter user lookup failed")
