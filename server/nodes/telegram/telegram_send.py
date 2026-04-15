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
        """Inlined from handlers/telegram.py:handle_telegram_send (Wave 11.D.1)."""
        from core.logging import get_logger
        from services.telegram_service import get_telegram_service

        log = get_logger(__name__)
        service = get_telegram_service()
        if not service.connected:
            raise RuntimeError(
                "Telegram bot not connected. Add bot token in Credentials.",
            )

        if params.recipient_type == "self":
            chat_id = service.owner_chat_id
            if not chat_id:
                try:
                    from core.container import container
                    saved = await container.auth_service().get_api_key("telegram_owner_chat_id")
                    if saved:
                        owner_id = int(saved)
                        await service.set_owner(owner_id)
                        chat_id = owner_id
                        log.info(f"[Telegram] Owner restored from credentials: {owner_id}")
                except Exception as e:
                    log.warning(f"[Telegram] Failed to restore owner: {e}")
            if not chat_id:
                raise RuntimeError(
                    "Bot owner not detected. Send any private message to your bot "
                    "on Telegram to auto-detect, or set TELEGRAM_OWNER_CHAT_ID in .env",
                )
        else:
            chat_id = params.chat_id
            if not chat_id:
                raise RuntimeError("chat_id is required")

        parse_mode = params.parse_mode if params.parse_mode != "None" else None
        reply_to = int(params.reply_to_message_id) if params.reply_to_message_id else None

        common = dict(
            chat_id=chat_id,
            disable_notification=params.silent,
            reply_to_message_id=reply_to,
        )
        mt = params.message_type
        if mt == "text":
            if not params.text:
                raise RuntimeError("text is required for text message")
            result = await service.send_message(
                text=params.text, parse_mode=parse_mode, **common,
            )
        elif mt == "photo":
            if not params.media_url:
                raise RuntimeError("media_url is required for photo message")
            result = await service.send_photo(
                photo=params.media_url, caption=params.caption or None,
                parse_mode=parse_mode, **common,
            )
        elif mt == "document":
            if not params.media_url:
                raise RuntimeError("media_url is required for document message")
            result = await service.send_document(
                document=params.media_url, caption=params.caption or None,
                parse_mode=parse_mode, **common,
            )
        elif mt == "location":
            if params.latitude is None or params.longitude is None:
                raise RuntimeError(
                    "latitude and longitude are required for location message",
                )
            result = await service.send_location(
                latitude=float(params.latitude),
                longitude=float(params.longitude),
                **common,
            )
        elif mt == "contact":
            if not params.phone or not params.first_name:
                raise RuntimeError(
                    "phone and first_name are required for contact message",
                )
            result = await service.send_contact(
                phone_number=params.phone,
                first_name=params.first_name,
                last_name=params.last_name or None,
                **common,
            )
        else:
            raise RuntimeError(f"Unsupported message type: {mt}")

        log.info(
            f"[Telegram] Message sent: type={mt}, chat={chat_id}, "
            f"msg_id={result.get('message_id')}",
        )
        return {
            "message_id": result.get("message_id"),
            "chat_id": result.get("chat_id"),
            "message_type": mt,
            "date": result.get("date"),
        }
