"""WhatsApp DB — Wave 11.C migration.

Dual-purpose ActionNode + AI tool. 18-operation query interface to the
WhatsApp database (chat history, contacts, groups, channels, …).
Operation matrix is large; legacy handler dispatches all of it.
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class WhatsAppDbParams(BaseModel):
    operation: Literal[
        "chat_history", "search_groups", "get_group_info",
        "get_contact_info", "list_contacts", "check_contacts",
        "list_channels", "get_channel_info", "channel_messages",
        "channel_stats", "channel_follow", "channel_unfollow",
        "channel_create", "channel_mute", "channel_mark_viewed",
        "newsletter_react", "newsletter_live_updates",
        "contact_profile_pic",
    ] = "chat_history"
    chat_id: str = Field(default="", alias="chatId")
    group_id: str = Field(default="", alias="groupId")
    phone_number: str = Field(default="", alias="phoneNumber")
    limit: int = Field(default=20, ge=1, le=500)
    offset: int = Field(default=0, ge=0)
    include_media_data: bool = Field(default=False, alias="includeMediaData")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class WhatsAppDbOutput(BaseModel):
    operation: Optional[str] = None
    messages: Optional[list] = None
    contacts: Optional[list] = None
    groups: Optional[list] = None
    channels: Optional[list] = None
    total: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class WhatsAppDbNode(ActionNode):
    type = "whatsappDb"
    display_name = "WhatsApp DB"
    subtitle = "Query DB"
    icon = "asset:whatsapp-db"
    color = "#25D366"
    group = ("whatsapp", "tool")
    description = "Query WhatsApp database (chat history, contacts, groups, channels)"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.MESSAGING
    usable_as_tool = True

    Params = WhatsAppDbParams
    Output = WhatsAppDbOutput

    @Operation("query", cost={"service": "whatsapp", "action": "db_query", "count": 1})
    async def query(self, ctx: NodeContext, params: WhatsAppDbParams) -> Any:
        from ._base import handle_whatsapp_db
        response = await handle_whatsapp_db(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=False), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "WhatsApp DB query failed")
