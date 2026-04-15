"""Social Send — Wave 11.C migration.

Unified send action for any social platform (WhatsApp / Telegram /
Discord / Slack / SMS / etc.). Multi-input handle topology:
message / media / contact / metadata as separate left-side handles.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


_SOCIAL_SIZE = {"width": 260, "height": 160}


class SocialSendParams(BaseModel):
    platform: Optional[str] = None
    recipient: Optional[str] = None
    text: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class SocialSendOutput(BaseModel):
    sent: Optional[bool] = None
    message_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class SocialSendNode(ActionNode):
    type = "socialSend"
    display_name = "Social Send"
    subtitle = "Send Message"
    icon = "asset:social"
    color = "#bd93f9"
    group = ("social", "tool")
    description = "Unified send action for any social platform"
    component_kind = "agent"   # multi-handle layout uses AIAgentNode component
    handles = (
        {"name": "input-message",  "kind": "input", "position": "left", "offset": "15%", "label": "Message",  "role": "main"},
        {"name": "input-media",    "kind": "input", "position": "left", "offset": "35%", "label": "Media",    "role": "main"},
        {"name": "input-contact",  "kind": "input", "position": "left", "offset": "55%", "label": "Contact",  "role": "main"},
        {"name": "input-metadata", "kind": "input", "position": "left", "offset": "75%", "label": "Metadata", "role": "main"},
    )
    ui_hints = _SOCIAL_SIZE
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.MESSAGING
    usable_as_tool = True

    Params = SocialSendParams
    Output = SocialSendOutput

    @Operation("send", cost={"service": "social", "action": "send", "count": 1})
    async def send(self, ctx: NodeContext, params: SocialSendParams) -> Any:
        from ._base import handle_social_send
        response = await handle_social_send(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "social send failed")
