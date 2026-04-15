"""Timer — Wave 11.C migration.

Sleep / delay node. Has both input and output handles (componentKind
"square") so it can be inserted mid-workflow as a deliberate pause,
not just at the start.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class TimerParams(BaseModel):
    duration: int = Field(default=1, ge=1, le=86400)
    unit: Literal["seconds", "minutes", "hours"] = "seconds"

    model_config = ConfigDict(extra="ignore")


class TimerOutput(BaseModel):
    elapsed: Optional[float] = None

    model_config = ConfigDict(extra="allow")


class TimerNode(ActionNode):
    type = "timer"
    display_name = "Timer"
    subtitle = "Delay Trigger"
    icon = "⏰"
    color = "#ffb86c"
    group = ("scheduler",)
    description = "Timer-based trigger with configurable delay"
    component_kind = "square"  # has input handle
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT
    usable_as_tool = True

    Params = TimerParams
    Output = TimerOutput

    @Operation("wait")
    async def wait(self, ctx: NodeContext, params: TimerParams) -> Any:
        from services.handlers.utility import handle_timer
        response = await handle_timer(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success") is False:
            raise RuntimeError(response.get("error") or "Timer failed")
        return response.get("result") or {}
