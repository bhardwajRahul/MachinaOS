"""Google Calendar — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class CalendarParams(BaseModel):
    operation: Literal["create", "list", "update", "delete"] = "list"
    calendar_id: str = Field(default="primary", alias="calendarId")
    event_id: str = Field(default="", alias="eventId")
    summary: str = Field(default="")
    description: str = Field(default="")
    start_time: str = Field(default="", alias="startTime")
    end_time: str = Field(default="", alias="endTime")
    location: str = Field(default="")
    attendees: str = Field(default="")
    max_results: int = Field(default=10, alias="maxResults", ge=1, le=250)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class CalendarOutput(BaseModel):
    operation: Optional[str] = None
    event_id: Optional[str] = None
    events: Optional[list] = None
    count: Optional[int] = None
    deleted: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class CalendarNode(ActionNode):
    type = "calendar"
    display_name = "Calendar"
    subtitle = "Event Management"
    icon = "asset:calendar"
    color = "#4285F4"
    group = ("google", "tool")
    description = "Google Calendar create / list / update / delete events"
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

    Params = CalendarParams
    Output = CalendarOutput

    @Operation("dispatch", cost={"service": "calendar", "action": "op", "count": 1})
    async def dispatch(self, ctx: NodeContext, params: CalendarParams) -> Any:
        from services.handlers.calendar import handle_google_calendar
        response = await handle_google_calendar(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Calendar op failed")
