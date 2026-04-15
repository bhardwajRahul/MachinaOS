"""Write Todos Tool — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import NodeContext, Operation, TaskQueue, ToolNode


class TodoItem(BaseModel):
    id: Optional[str] = None
    content: str
    status: Literal["pending", "in_progress", "completed"] = "pending"


class WriteTodosParams(BaseModel):
    todos: List[TodoItem] = Field(default_factory=list)

    model_config = ConfigDict(extra="allow")


class WriteTodosOutput(BaseModel):
    todos: Optional[list] = None
    summary: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class WriteTodosNode(ToolNode):
    type = "writeTodos"
    display_name = "Write Todos"
    subtitle = "Plan-Work-Update Loop"
    icon = "✅"
    color = "#bd93f9"
    group = ("tool", "ai")
    description = "Structured task list planning for complex multi-step operations"
    component_kind = "tool"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-tool", "kind": "output", "position": "top",
         "label": "Tool", "role": "tools"},
    )
    ui_hints = {"isToolPanel": True, "hideRunButton": True}
    annotations = {"destructive": False, "readonly": False, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = WriteTodosParams
    Output = WriteTodosOutput

    @Operation("write")
    async def write(self, ctx: NodeContext, params: WriteTodosParams) -> Any:
        from services.handlers.todo import execute_write_todos
        config = {
            "node_id": ctx.node_id,
            "workspace_dir": ctx.workspace_dir or "",
            "workflow_id": ctx.workflow_id,
            "session_id": ctx.session_id,
        }
        return await execute_write_todos(params.model_dump(), config)
