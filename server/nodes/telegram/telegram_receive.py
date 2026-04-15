"""Telegram Receive — Wave 11.C migration (event-based trigger).

Long-polling Telegram bot dispatches events into ``event_waiter``
under ``telegram_message_received``. The plugin's filter narrows by
sender/content type; legacy ``build_telegram_filter`` stays wired
through ``FILTER_BUILDERS`` until 11.F unifies dispatch.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import NodeContext, Operation, TaskQueue, TriggerNode

from credentials.telegram import TelegramCredential


class TelegramReceiveParams(BaseModel):
    content_type_filter: Literal[
        "all", "text", "photo", "video", "audio", "voice", "document",
        "sticker", "location", "contact", "poll",
    ] = Field(default="all", alias="contentTypeFilter")
    sender_filter: Literal[
        "all", "self", "private", "group", "supergroup", "channel",
        "specific_chat", "specific_user", "keywords",
    ] = Field(default="all", alias="senderFilter")
    chat_id: str = Field(
        default="", alias="chatId",
        json_schema_extra={"displayOptions": {"show": {"sender_filter": ["specific_chat"]}}},
    )
    from_user: str = Field(
        default="", alias="fromUser",
        json_schema_extra={"displayOptions": {"show": {"sender_filter": ["specific_user"]}}},
    )
    keywords: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"sender_filter": ["keywords"]}}},
    )
    ignore_bots: bool = Field(default=True, alias="ignoreBots")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class TelegramReceiveOutput(BaseModel):
    message_id: Optional[int] = None
    chat_id: Optional[int] = None
    chat_type: Optional[str] = None
    chat_title: Optional[str] = None
    from_id: Optional[int] = None
    from_username: Optional[str] = None
    from_first_name: Optional[str] = None
    from_last_name: Optional[str] = None
    is_bot: Optional[bool] = None
    text: Optional[str] = None
    content_type: Optional[str] = None
    date: Optional[str] = None
    reply_to_message_id: Optional[int] = None
    photo: Optional[dict] = None
    document: Optional[dict] = None
    location: Optional[dict] = None
    contact: Optional[dict] = None

    model_config = ConfigDict(extra="allow")


class TelegramReceiveNode(TriggerNode):
    type = "telegramReceive"
    display_name = "Telegram Receive"
    subtitle = "Inbound Message"
    icon = "asset:telegram"
    color = "#0088CC"
    group = ("social", "trigger")
    description = "Trigger workflow when Telegram message is received"
    component_kind = "trigger"
    handles = (
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    credentials = (TelegramCredential,)
    task_queue = TaskQueue.TRIGGERS_EVENT
    mode = "event"
    event_type = "telegram_message_received"

    Params = TelegramReceiveParams
    Output = TelegramReceiveOutput

    def build_filter(self, params: TelegramReceiveParams) -> Callable[[Dict[str, Any]], bool]:
        # Delegate to legacy filter builder for full feature parity —
        # 11.F ports the body and removes the legacy registry entry.
        from services.event_waiter import build_telegram_filter
        return build_telegram_filter(params.model_dump(by_alias=True))

    @Operation("wait")
    async def wait(self, ctx: NodeContext, params: TelegramReceiveParams) -> TelegramReceiveOutput:
        raise NotImplementedError(
            "Event triggers return via TriggerNode.execute, not the op body"
        )
