"""Simple Memory — Wave 11.C migration.

Markdown-based conversation memory, optionally backed by a vector
store for semantic recall. Connects upward to an agent's input-memory
handle. Delegates execution to the legacy ``handle_simple_memory``.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class SimpleMemoryParams(BaseModel):
    session_id: str = Field(default="default", alias="sessionId")
    window_size: int = Field(default=10, alias="windowSize", ge=1, le=100)
    memory_content: str = Field(
        default="# Conversation History\n",
        alias="memoryContent",
        json_schema_extra={"rows": 12},
    )
    long_term_enabled: bool = Field(default=False, alias="longTermEnabled")
    retrieval_count: int = Field(
        default=3, alias="retrievalCount", ge=1, le=20,
        json_schema_extra={"displayOptions": {"show": {"long_term_enabled": [True]}}},
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class SimpleMemoryOutput(BaseModel):
    memory_content: Optional[str] = None
    message_count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class SimpleMemoryNode(ActionNode):
    type = "simpleMemory"
    display_name = "Simple Memory"
    subtitle = "Conversation History"
    icon = "💾"
    color = "#f1fa8c"
    group = ("tool", "memory")
    description = "Markdown-based conversation memory with optional vector DB"
    component_kind = "model"
    handles = (
        {"name": "output-memory", "kind": "output", "position": "top",
         "label": "Memory", "role": "memory"},
    )
    ui_hints = {"isMemoryPanel": True, "hasCodeEditor": True, "hideRunButton": True}
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = SimpleMemoryParams
    Output = SimpleMemoryOutput

    @Operation("read")
    async def read(self, ctx: NodeContext, params: SimpleMemoryParams) -> Any:
        from services.handlers.ai import handle_simple_memory
        response = await handle_simple_memory(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success") is False:
            raise RuntimeError(response.get("error") or "simpleMemory failed")
        return response.get("result") or {}
