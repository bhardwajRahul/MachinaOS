"""Process Manager — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ProcessManagerParams(BaseModel):
    # Pre-refactor contract: unknown op -> "Unknown operation ..."
    # from handler, not Pydantic error.
    operation: str = Field(default="list")
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
        """Inlined from handlers/process.py (Wave 11.D.1)."""
        import os
        from services.process_service import get_process_service

        svc = get_process_service()
        workflow_id = ctx.workflow_id or "default"
        workspace_dir = ctx.workspace_dir or ""
        # Each agent node gets its own subfolder in the workspace.
        agent_dir = os.path.join(workspace_dir, ctx.node_id) if workspace_dir else ""

        op = params.operation
        name = _clean(params.name)

        # Pre-refactor contract: the envelope the service returns is
        # `{success, result: {...}, error?}`; the plugin's own return
        # should be the INNER result dict so downstream gets the flat
        # shape (name, status, pid, ...) at `result["result"]`.
        def _unwrap(envelope: Any) -> Any:
            if isinstance(envelope, dict) and "result" in envelope and "success" in envelope:
                if not envelope.get("success"):
                    raise RuntimeError(envelope.get("error") or "Process service error")
                return envelope.get("result") or {}
            return envelope

        if op == "start":
            return _unwrap(await svc.start(
                name=name,
                command=_clean(params.command),
                workflow_id=workflow_id,
                working_directory=_clean(params.cwd) or agent_dir,
            ))
        if op == "stop":
            return _unwrap(await svc.stop(name, workflow_id))
        if op == "restart":
            return _unwrap(await svc.restart(name, workflow_id))
        if op == "send_input":
            return _unwrap(await svc.send_input(name, workflow_id, _clean(params.input_text)))
        if op == "list":
            return {"processes": svc.list_processes(workflow_id)}
        if op == "get_output":
            return svc.get_output(name, workflow_id, params.stream, params.tail, 0)
        raise RuntimeError(f"Unknown operation: {op}")


def _clean(val: str) -> str:
    """LLMs sometimes pass literal 'None' string instead of omitting the field."""
    if not val or val == "None":
        return ""
    return val
