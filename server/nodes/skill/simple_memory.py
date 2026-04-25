"""Simple Memory — Wave 11.E.3 inlined.

Markdown-based conversation memory, optionally backed by a vector
store for semantic recall. Connects upward to an agent's input-memory
handle. The plugin queries the in-memory ``MessageStore`` directly;
agents read the ``memory_content`` parameter (the editable markdown)
plus the live message log returned here.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.logging import get_logger
from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

logger = get_logger(__name__)


class SimpleMemoryParams(BaseModel):
    session_id: str = Field(default="default")
    window_size: int = Field(default=10, ge=1, le=100)
    memory_content: str = Field(
        default="# Conversation History\n",
        json_schema_extra={"rows": 12},
    )
    memory_type: Literal["buffer", "window"] = Field(default="buffer")
    clear_on_run: bool = Field(default=False)
    long_term_enabled: bool = Field(default=False)
    retrieval_count: int = Field(
        default=3, ge=1, le=20,
        json_schema_extra={"displayOptions": {"show": {"long_term_enabled": [True]}}},
    )

    model_config = ConfigDict(extra="ignore")


class SimpleMemoryOutput(BaseModel):
    memory_content: Optional[str] = None
    message_count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class SimpleMemoryNode(ActionNode):
    type = "simpleMemory"
    display_name = "Simple Memory"
    subtitle = "Conversation History"
    icon = "🧠"
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
    async def read(self, ctx: NodeContext, params: SimpleMemoryParams) -> SimpleMemoryOutput:
        """Return the current message log for the session.

        All fields read via Pydantic-typed access on ``params`` — no dict
        lookups needed now that aliases are gone.
        """
        from services.memory_store import clear_session, get_messages

        session_id = params.session_id
        memory_type = params.memory_type
        window_size = params.window_size if memory_type == "window" else None

        if params.clear_on_run:
            cleared = clear_session(session_id)
            logger.info("[Memory] Cleared %d messages from session '%s'", cleared, session_id)

        messages = get_messages(session_id, window_size)
        return SimpleMemoryOutput(
            memory_content=params.memory_content,
            message_count=len(messages),
            session_id=session_id,
            messages=messages,
            memory_type=memory_type,
            window_size=window_size,
        )
