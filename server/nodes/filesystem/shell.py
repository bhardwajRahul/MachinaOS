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
        """Inlined from handlers/filesystem.py (Wave 11.D.1)."""
        import asyncio
        from core.logging import get_logger
        from ._backend import get_backend

        log = get_logger(__name__)
        backend = get_backend(params.model_dump(), ctx.raw)
        log.info(
            "[Shell] Executing (non-blocking): %s (timeout=%ds)",
            params.command[:200], params.timeout,
        )
        result = await asyncio.to_thread(
            backend.execute, params.command, timeout=params.timeout,
        )
        if result.exit_code == 124:
            log.warning("[Shell] Timed out after %ds: %s", params.timeout, params.command[:100])
        elif result.exit_code != 0:
            log.warning(
                "[Shell] Non-zero exit (%d): %s -> %s",
                result.exit_code, params.command[:100], result.output[:300],
            )
        else:
            log.info("[Shell] Completed: exit=%d len=%d", result.exit_code, len(result.output))

        return {
            "stdout": result.output,
            "exit_code": result.exit_code,
            "truncated": result.truncated,
            "command": params.command,
        }
