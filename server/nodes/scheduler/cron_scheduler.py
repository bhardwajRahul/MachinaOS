"""Cron Scheduler — Wave 11.C migration.

Cron-expression-based scheduling trigger. Deployment-mode lifecycle
(starting/stopping the cron job) is owned by ``deployment/triggers.py``;
the run-button path runs handle_cron_scheduler directly for one-shot
testing.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class CronSchedulerParams(BaseModel):
    cron_expression: str = Field(default="0 * * * *", alias="cronExpression")
    timezone: str = Field(default="UTC")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class CronSchedulerOutput(BaseModel):
    triggered_at: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class CronSchedulerNode(ActionNode):
    type = "cronScheduler"
    display_name = "Cron Scheduler"
    subtitle = "Time-Based Trigger"
    icon = "⏱"
    color = "#ffb86c"
    group = ("scheduler", "trigger")
    description = "Cron expression-based scheduling trigger"
    component_kind = "trigger"
    handles = (
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.TRIGGERS_POLL

    Params = CronSchedulerParams
    Output = CronSchedulerOutput

    @Operation("trigger")
    async def trigger(self, ctx: NodeContext, params: CronSchedulerParams) -> Any:
        from services.handlers.utility import handle_cron_scheduler
        response = await handle_cron_scheduler(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success") is False:
            raise RuntimeError(response.get("error") or "Cron failed")
        return response.get("result") or {}
