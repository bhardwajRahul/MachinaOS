"""Team Monitor — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class TeamMonitorParams(BaseModel):
    team_id: str = Field(default="", alias="teamId")
    auto_refresh: bool = Field(default=True, alias="autoRefresh")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class TeamMonitorOutput(BaseModel):
    team: Optional[dict] = None
    members: Optional[list] = None
    tasks: Optional[list] = None

    model_config = ConfigDict(extra="allow")


class TeamMonitorNode(ActionNode):
    type = "teamMonitor"
    display_name = "Team Monitor"
    subtitle = "Agent Team Status"
    icon = "📊"
    color = "#bd93f9"
    group = ("utility",)
    description = "Real-time monitoring of Agent Team operations"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    ui_hints = {"isMonitorPanel": True, "hideInputSection": True, "hideOutputSection": True}
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = TeamMonitorParams
    Output = TeamMonitorOutput

    @Operation("monitor")
    async def monitor(self, ctx: NodeContext, params: TeamMonitorParams) -> Any:
        from services.handlers.utility import handle_team_monitor
        response = await handle_team_monitor(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success") is False:
            raise RuntimeError(response.get("error") or "Team monitor failed")
        return response.get("result") or {}
