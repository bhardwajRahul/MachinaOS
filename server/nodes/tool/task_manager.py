"""Task Manager Tool — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import NodeContext, Operation, TaskQueue, ToolNode


class TaskManagerParams(BaseModel):
    action: Literal["create", "list", "complete", "delete", "update"] = "create"
    task_id: Optional[str] = Field(default=None)
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class TaskManagerOutput(BaseModel):
    task_id: Optional[str] = None
    tasks: Optional[list] = None
    success: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class TaskManagerNode(ToolNode):
    type = "taskManager"
    display_name = "Task Manager"
    subtitle = "AI Task Tracking"
    icon = "lucide:ClipboardList"
    color = "#f1fa8c"
    group = ("tool", "ai")
    description = "Task management tool for AI agents to create, track, and manage tasks"
    component_kind = "tool"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-tool", "kind": "output", "position": "top",
         "label": "Tool", "role": "tools"},
    )
    ui_hints = {"isToolPanel": True, "hideRunButton": True}
    annotations = {"destructive": True, "readonly": False, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = TaskManagerParams
    Output = TaskManagerOutput

    @Operation("manage")
    async def manage(self, ctx: NodeContext, params: TaskManagerParams) -> Any:
        from services.handlers.tools import _execute_task_manager
        return await _execute_task_manager(
            params.model_dump(), {"node_id": ctx.node_id, "workspace_dir": ctx.workspace_dir or ""},
        )
