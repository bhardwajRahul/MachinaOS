"""Telegram Send — Wave 11.C migration.

Dual-purpose: workflow ActionNode + AI tool. The Telegram bot token
lives in ``auth_service`` under ``telegram_bot_token``. Plugin
delegates to the legacy ``handle_telegram_send`` handler during
thin-migration; 11.E converts to a declarative ``TelegramCredential``.
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class TelegramSendParams(BaseModel):
    recipient_type: Literal["self", "chat_id"] = Field(
        default="self", alias="recipientType",
    )
    chat_id: str = Field(
        default="", alias="chatId",
        json_schema_extra={"displayOptions": {"show": {"recipient_type": ["chat_id"]}}},
    )
    message_type: Literal["text", "photo", "document", "location", "contact"] = Field(
        default="text", alias="messageType",
    )
    text: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["text"]}}},
    )
    media_url: str = Field(
        default="", alias="mediaUrl",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["photo", "document"]}}},
    )
    caption: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["photo", "document"]}}},
    )
    latitude: Optional[float] = Field(
        default=None,
        json_schema_extra={"displayOptions": {"show": {"message_type": ["location"]}}},
    )
    longitude: Optional[float] = Field(
        default=None,
        json_schema_extra={"displayOptions": {"show": {"message_type": ["location"]}}},
    )
    phone: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["contact"]}}},
    )
    first_name: str = Field(
        default="", alias="firstName",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["contact"]}}},
    )
    last_name: str = Field(
        default="", alias="lastName",
        json_schema_extra={"displayOptions": {"show": {"message_type": ["contact"]}}},
    )
    parse_mode: Literal["Auto", "HTML", "Markdown", "MarkdownV2", "None"] = Field(
        default="Auto", alias="parseMode",
    )
    silent: bool = False
    reply_to_message_id: Optional[int] = Field(default=None, alias="replyToMessageId")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class TelegramSendOutput(BaseModel):
    message_id: Optional[int] = None
    chat_id: Optional[int] = None
    sent: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class TelegramSendNode(ActionNode):
    type = "telegramSend"
    display_name = "Telegram Send"
    subtitle = "Send Message"
    icon = "asset:telegram"
    color = "#0088CC"
    group = ("social", "tool")
    description = "Send text, photo, document, location, or contact via Telegram bot"
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

    Params = TelegramSendParams
    Output = TelegramSendOutput

    @Operation("send", cost={"service": "telegram", "action": "send", "count": 1})
    async def send(self, ctx: NodeContext, params: TelegramSendParams) -> Any:
        from services.handlers.telegram import handle_telegram_send
        payload = params.model_dump(by_alias=True)
        response = await handle_telegram_send(
            node_id=ctx.node_id, node_type=self.type,
            parameters=payload, context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Telegram send failed")
