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
        from services.agent_team import get_agent_team_service

        team_id = ctx.raw.get("team_id")
        if not team_id:
            for output in (ctx.raw.get("outputs", {}) or {}).values():
                if isinstance(output, dict) and output.get("team_id"):
                    team_id = output["team_id"]
                    break

        if not team_id:
            return {
                "message": "No team connected",
                "team_id": None,
                "members": [],
                "tasks": {"total": 0, "completed": 0, "active": 0, "pending": 0, "failed": 0},
                "active_tasks": [],
                "recent_events": [],
            }

        status = await get_agent_team_service().get_team_status(team_id)
        max_history = ctx.raw.get("parameters", {}).get("maxHistoryItems", 50)
        return {
            "team_id": team_id,
            "members": status.get("members", []),
            "tasks": {
                "total": status.get("task_count", 0),
                "completed": status.get("completed_count", 0),
                "active": status.get("active_count", 0),
                "pending": status.get("pending_count", 0),
                "failed": status.get("failed_count", 0),
            },
            "active_tasks": status.get("active_tasks", []),
            "recent_events": status.get("recent_events", [])[-max_history:],
        }
