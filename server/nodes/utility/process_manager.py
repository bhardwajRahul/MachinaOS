"""Process Manager — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ProcessManagerParams(BaseModel):
    operation: Literal["start", "stop", "restart", "list", "send_input", "get_output"] = "list"
    name: str = Field(default="")
    command: str = Field(default="")
    cwd: str = Field(default="")
    env: Dict[str, str] = Field(default_factory=dict)
    input_text: str = Field(default="", alias="inputText")
    stream: Literal["stdout", "stderr"] = "stdout"
    tail: int = Field(default=100, ge=1, le=10000)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ProcessManagerOutput(BaseModel):
    operation: Optional[str] = None
    pid: Optional[int] = None
    status: Optional[str] = None
    output: Optional[str] = None
    processes: Optional[list] = None

    model_config = ConfigDict(extra="allow")


class ProcessManagerNode(ActionNode):
    type = "processManager"
    display_name = "Process Manager"
    subtitle = "Long-Running Subprocess"
    icon = "⚙️"
    color = "#bd93f9"
    group = ("utility", "tool")
    description = "Start, stop, restart, and manage long-running processes"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": True, "readonly": False, "open_world": True}
    task_queue = TaskQueue.DEFAULT
    usable_as_tool = True

    Params = ProcessManagerParams
    Output = ProcessManagerOutput

    @Operation("dispatch")
    async def dispatch(self, ctx: NodeContext, params: ProcessManagerParams) -> Any:
        from services.handlers.process import handle_process_manager
        response = await handle_process_manager(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Process manager failed")
