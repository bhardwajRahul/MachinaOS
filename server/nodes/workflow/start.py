"""Start node — Wave 11.C migration.

Workflow entry point. Provides initial data to downstream nodes from
a user-authored JSON blob (``initialData``) on the node itself. Has
its own componentKind="start" because the StartNode component is a
distinct visual treatment from generic triggers.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class StartParams(BaseModel):
    initial_data: Any = Field(default=None, alias="initialData")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class StartOutput(BaseModel):
    data: Optional[Any] = None

    model_config = ConfigDict(extra="allow")


class StartNode(ActionNode):
    type = "start"
    display_name = "Start"
    subtitle = "Workflow Start"
    icon = "▶"
    color = "#bd93f9"
    group = ("workflow",)
    description = "Starting point for workflow execution. Provides initial data to connected nodes."
    component_kind = "start"
    handles = (
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    ui_hints = {
        "hideInputSection": True,
        "hideOutputSection": True,
        "hasInitialDataBlob": True,
    }
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = StartParams
    Output = StartOutput

    @Operation("emit")
    async def emit(self, ctx: NodeContext, params: StartParams) -> Any:
        from services.handlers.utility import handle_start
        response = await handle_start(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success") is False:
            raise RuntimeError(response.get("error") or "Start failed")
        return response.get("result") or {}
