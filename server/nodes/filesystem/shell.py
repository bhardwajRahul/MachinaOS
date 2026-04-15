"""Shell — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ShellParams(BaseModel):
    command: str = Field(..., min_length=1)
    cwd: str = Field(default="")
    timeout: int = Field(default=30, ge=1, le=600)

    model_config = ConfigDict(extra="ignore")


class ShellOutput(BaseModel):
    stdout: Optional[str] = None
    exit_code: Optional[int] = None
    truncated: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class ShellNode(ActionNode):
    type = "shell"
    display_name = "Shell"
    subtitle = "Run Command"
    icon = "$_"
    color = "#8be9fd"
    group = ("filesystem", "tool")
    description = "Execute shell commands (sandboxed; no system PATH)"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": True, "readonly": False, "open_world": True}
    task_queue = TaskQueue.DEFAULT
    usable_as_tool = True

    Params = ShellParams
    Output = ShellOutput

    @Operation("execute")
    async def execute_op(self, ctx: NodeContext, params: ShellParams) -> Any:
        from services.handlers.filesystem import handle_shell
        response = await handle_shell(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Shell command failed")
