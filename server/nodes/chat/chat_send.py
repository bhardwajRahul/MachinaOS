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
        from core.container import container

        if not params.message:
            raise RuntimeError("Chat message is required")

        database = container.database()
        ok = await database.add_chat_message(params.session_id, "assistant", params.message)
        if not ok:
            raise RuntimeError("Failed to persist chat message")
        return ChatSendOutput(sent=True, message_id=None)
