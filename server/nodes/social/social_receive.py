"""Social Receive — Wave 11.C migration.

Normalises messages from any platform trigger (whatsappReceive,
telegramReceive, etc.) into a unified shape and fans out across four
right-side output handles: message / media / contact / metadata.

Reads ``connected_outputs`` from the executor's enriched context;
delegates the per-platform unwrap to the existing handler.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


_SOCIAL_SIZE = {"width": 260, "height": 160}


class SocialReceiveParams(BaseModel):
    """Pure passthrough — no user-facing params; all data flows from
    upstream trigger nodes via connected_outputs."""

    model_config = ConfigDict(extra="allow")


class SocialReceiveOutput(BaseModel):
    message: Optional[Any] = None
    media: Optional[Any] = None
    contact: Optional[Any] = None
    metadata: Optional[Any] = None

    model_config = ConfigDict(extra="allow")


class SocialReceiveNode(ActionNode):
    type = "socialReceive"
    display_name = "Social Receive"
    subtitle = "Normalize Message"
    icon = "asset:social"
    color = "#bd93f9"
    group = ("social",)
    description = "Normalizes messages from platform triggers into unified format"
    component_kind = "agent"   # multi-handle layout uses AIAgentNode
    handles = (
        {"name": "output-message",  "kind": "output", "position": "right", "offset": "20%", "label": "Message",  "role": "main"},
        {"name": "output-media",    "kind": "output", "position": "right", "offset": "40%", "label": "Media",    "role": "main"},
        {"name": "output-contact",  "kind": "output", "position": "right", "offset": "60%", "label": "Contact",  "role": "main"},
        {"name": "output-metadata", "kind": "output", "position": "right", "offset": "80%", "label": "Metadata", "role": "main"},
    )
    ui_hints = _SOCIAL_SIZE
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = SocialReceiveParams
    Output = SocialReceiveOutput

    @Operation("normalize")
    async def normalize(self, ctx: NodeContext, params: SocialReceiveParams) -> Any:
        from ._base import handle_social_receive
        outputs = ctx.raw.get("connected_outputs") or {}
        source_nodes = ctx.raw.get("source_nodes") or []
        response = await handle_social_receive(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
            connected_outputs=outputs, source_nodes=source_nodes,
        )
        if response.get("success") is False:
            raise RuntimeError(response.get("error") or "social receive failed")
        return response.get("result") or {}


# socialReceive needs the executor's connected_outputs injection
# (alongside console / pythonExecutor / webhookResponse / socialReceive
# already in _NEEDS_CONNECTED_OUTPUTS); the legacy entry stays.
