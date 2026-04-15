"""Chat History — Wave 11.C migration. Retrieves chat conversation history."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ChatHistoryParams(BaseModel):
    session_id: str = Field(default="default", alias="sessionId")
    limit: int = Field(default=50, ge=1, le=500)

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ChatHistoryOutput(BaseModel):
    messages: Optional[list] = None
    count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class ChatHistoryNode(ActionNode):
    type = "chatHistory"
    display_name = "Chat History"
    subtitle = "Retrieve Messages"
    icon = "asset:chat"
    color = "#8be9fd"
    group = ("chat",)
    description = "Retrieve chat conversation history"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = ChatHistoryParams
    Output = ChatHistoryOutput

    @Operation("read")
    async def read(self, ctx: NodeContext, params: ChatHistoryParams) -> Any:
        from core.container import container

        database = container.database()
        messages = await database.get_chat_messages(params.session_id, limit=params.limit)
        return ChatHistoryOutput(messages=messages, count=len(messages))
