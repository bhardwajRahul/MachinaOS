"""Google Tasks — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class TasksParams(BaseModel):
    operation: Literal["create", "list", "complete", "update", "delete"] = "list"
    task_list_id: str = Field(default="@default", alias="taskListId")
    task_id: str = Field(default="", alias="taskId")
    title: str = Field(default="")
    notes: str = Field(default="")
    due: str = Field(default="")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class TasksOutput(BaseModel):
    operation: Optional[str] = None
    task_id: Optional[str] = None
    tasks: Optional[list] = None

    model_config = ConfigDict(extra="allow")


class TasksNode(ActionNode):
    type = "tasks"
    display_name = "Tasks"
    subtitle = "Task Management"
    icon = "asset:tasks"
    color = "#4285F4"
    group = ("google", "tool")
    description = "Google Tasks create / list / complete / update / delete"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = TasksParams
    Output = TasksOutput

    @Operation("dispatch", cost={"service": "tasks", "action": "op", "count": 1})
    async def dispatch(self, ctx: NodeContext, params: TasksParams) -> Any:
        from services.handlers.tasks import handle_google_tasks
        response = await handle_google_tasks(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Tasks op failed")
