"""Twitter Send — Wave 11.C migration. Dual-purpose ActionNode + AI tool."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class TwitterSendParams(BaseModel):
    action: Literal["tweet", "reply", "retweet", "like", "unlike", "delete"] = "tweet"
    text: str = Field(default="")
    tweet_id: str = Field(default="", alias="tweetId")
    reply_to_id: str = Field(default="", alias="replyToId")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class TwitterSendOutput(BaseModel):
    tweet_id: Optional[str] = None
    success: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class TwitterSendNode(ActionNode):
    type = "twitterSend"
    display_name = "Twitter Send"
    subtitle = "Tweet / Reply"
    icon = "asset:x"
    color = "#1DA1F2"
    group = ("social", "tool")
    description = "Post tweets, reply, retweet, like, or delete tweets on Twitter/X"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.MESSAGING
    usable_as_tool = True

    Params = TwitterSendParams
    Output = TwitterSendOutput

    @Operation("send", cost={"service": "twitter", "action": "send", "count": 1})
    async def send(self, ctx: NodeContext, params: TwitterSendParams) -> Any:
        from services.handlers.twitter import handle_twitter_send
        response = await handle_twitter_send(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Twitter send failed")
