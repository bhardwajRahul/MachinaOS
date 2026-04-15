"""WhatsApp Send — Wave 11.C migration.

Dual-purpose ActionNode + AI tool. Sends text / media / location /
contact / sticker via the whatsapp-rpc bridge. Delegates to the
existing handler — recipient/message-type matrix is already encoded
there with full media + newsletter-channel support.
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class WhatsAppSendParams(BaseModel):
    recipient_type: Literal["self", "phone", "group", "channel"] = Field(
        default="phone", alias="recipientType",
    )
    phone_number: str = Field(default="", alias="phoneNumber")
    group_id: str = Field(default="", alias="groupId")
    channel_jid: str = Field(default="", alias="channelJid")
    message_type: Literal[
        "text", "image", "video", "audio", "document",
        "sticker", "location", "contact",
    ] = Field(default="text", alias="messageType")
    text: str = Field(default="")
    media_url: str = Field(default="", alias="mediaUrl")
    caption: str = Field(default="")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_name: str = Field(default="", alias="contactName")
    contact_phone: str = Field(default="", alias="contactPhone")
    format_markdown: bool = Field(default=True, alias="formatMarkdown")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class WhatsAppSendOutput(BaseModel):
    message_id: Optional[str] = None
    sent: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class WhatsAppSendNode(ActionNode):
    type = "whatsappSend"
    display_name = "WhatsApp Send"
    subtitle = "Send Message"
    icon = "asset:whatsapp-send"
    color = "#25D366"
    group = ("whatsapp", "tool")
    description = "Send WhatsApp messages (text, media, location, contact, sticker)"
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

    Params = WhatsAppSendParams
    Output = WhatsAppSendOutput

    @Operation("send", cost={"service": "whatsapp", "action": "send", "count": 1})
    async def send(self, ctx: NodeContext, params: WhatsAppSendParams) -> Any:
        from ._base import handle_whatsapp_send
        response = await handle_whatsapp_send(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "WhatsApp send failed")
