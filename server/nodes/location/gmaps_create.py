"""Google Maps Create — Wave 11.C migration. Renders an interactive map."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class GmapsCreateParams(BaseModel):
    center_lat: float = Field(default=0.0, alias="centerLat")
    center_lng: float = Field(default=0.0, alias="centerLng")
    zoom: int = Field(default=10, ge=1, le=20)
    map_type: Literal["roadmap", "satellite", "hybrid", "terrain"] = Field(
        default="roadmap", alias="mapType",
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class GmapsCreateOutput(BaseModel):
    map_id: Optional[str] = None
    config: Optional[dict] = None

    model_config = ConfigDict(extra="allow")


class GmapsCreateNode(ActionNode):
    type = "gmaps_create"
    display_name = "Map Create"
    subtitle = "Google Map"
    icon = "🗺️"
    color = "#50fa7b"
    group = ("location", "service")
    description = "Google Maps creation with center, zoom, and map type"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    ui_hints = {"showLocationPanel": True}
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = GmapsCreateParams
    Output = GmapsCreateOutput

    @Operation("create")
    async def create(self, ctx: NodeContext, params: GmapsCreateParams) -> Any:
        from core.container import container
        from services.handlers.utility import handle_create_map

        maps_service = container.maps_service()
        response = await handle_create_map(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True),
            context=ctx.raw, maps_service=maps_service,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Map create failed")
