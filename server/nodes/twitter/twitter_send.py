"""Twitter Send — Wave 11.D.8 inlined (tweet/reply/retweet/like/unlike/delete)."""

from __future__ import annotations

import asyncio
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._base import (
    call_with_retry, format_response, get_my_user_id, track_twitter_usage,
)


class TwitterSendParams(BaseModel):
    action: Literal["tweet", "reply", "retweet", "like", "unlike", "delete"] = "tweet"
    text: str = Field(default="")
    tweet_id: str = Field(default="", alias="tweetId")
    reply_to_id: str = Field(default="", alias="replyToId")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class TwitterSendOutput(BaseModel):
    action: Optional[str] = None
    data: Optional[dict] = None

    model_config = ConfigDict(extra="allow")


async def _do_send(client, action: str, p: dict, node_id: str, ctx_raw: dict) -> TwitterSendOutput:
    if action == "tweet":
        text = p.get("text", "")
        if not text:
            raise RuntimeError("Tweet text is required")
        result = await asyncio.to_thread(client.posts.create, body={"text": text[:280]})
        await track_twitter_usage(node_id, "tweet", 1, ctx_raw)
        return TwitterSendOutput(action="tweet_sent", data=format_response(result))

    if action == "reply":
        text = p.get("text", "")
        reply_to = p.get("replyToId") or p.get("reply_to_id")
        if not text or not reply_to:
            raise RuntimeError("Text and reply_to_id are required")
        result = await asyncio.to_thread(
            client.posts.create,
            body={"text": text[:280], "reply": {"in_reply_to_tweet_id": reply_to}},
        )
        await track_twitter_usage(node_id, "reply", 1, ctx_raw)
        return TwitterSendOutput(action="reply_sent", data=format_response(result))

    tweet_id = p.get("tweetId") or p.get("tweet_id")
    if not tweet_id:
        raise RuntimeError("tweet_id is required")

    if action == "retweet":
        user_id = await get_my_user_id(client)
        result = await asyncio.to_thread(
            client.users.repost_post, user_id, body={"tweet_id": tweet_id},
        )
        await track_twitter_usage(node_id, "retweet", 1, ctx_raw)
        return TwitterSendOutput(action="retweeted", data=format_response(result))

    if action == "like":
        user_id = await get_my_user_id(client)
        result = await asyncio.to_thread(
            client.users.like_post, user_id, body={"tweet_id": tweet_id},
        )
        await track_twitter_usage(node_id, "like", 1, ctx_raw)
        return TwitterSendOutput(action="liked", data=format_response(result))

    if action == "unlike":
        user_id = await get_my_user_id(client)
        result = await asyncio.to_thread(
            client.users.unlike_post, user_id, tweet_id=tweet_id,
        )
        await track_twitter_usage(node_id, "unlike", 1, ctx_raw)
        return TwitterSendOutput(action="unliked", data=format_response(result))

    if action == "delete":
        result = await asyncio.to_thread(client.posts.delete, tweet_id)
        await track_twitter_usage(node_id, "delete", 1, ctx_raw)
        return TwitterSendOutput(action="deleted", data=format_response(result))

    raise RuntimeError(f"Unknown action: {action}")


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
    async def send(self, ctx: NodeContext, params: TwitterSendParams) -> TwitterSendOutput:
        p = params.model_dump(by_alias=True)
        action = p.get("action", "tweet")
        return await call_with_retry(_do_send, action, p, ctx.node_id, ctx.raw)
