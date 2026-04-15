"""Chat Send — Wave 11.C migration. Sends messages to chat conversations."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ChatSendParams(BaseModel):
    session_id: str = Field(default="default", alias="sessionId")
    message: str = Field(default="")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ChatSendOutput(BaseModel):
    sent: Optional[bool] = None
    message_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ChatSendNode(ActionNode):
    type = "chatSend"
    display_name = "Chat Send"
    subtitle = "Send to Chat"
    icon = "asset:chat"
    color = "#8be9fd"
    group = ("chat",)
    description = "Send messages to chat conversations"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = ChatSendParams
    Output = ChatSendOutput

    @Operation("send")
    async def send(self, ctx: NodeContext, params: ChatSendParams) -> Any:
        from services.handlers.chat import handle_chat_send
        response = await handle_chat_send(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Chat send failed")
