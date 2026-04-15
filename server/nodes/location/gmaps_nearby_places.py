"""Google Maps Nearby Places — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class GmapsNearbyPlacesParams(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    radius: int = Field(default=1000, ge=1, le=50000)
    place_type: str = Field(default="", alias="placeType")
    keyword: str = Field(default="")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class GmapsNearbyPlacesOutput(BaseModel):
    places: Optional[list] = None
    count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class GmapsNearbyPlacesNode(ActionNode):
    type = "gmaps_nearby_places"
    display_name = "Nearby Places"
    subtitle = "Places API"
    icon = "🏪"
    color = "#50fa7b"
    group = ("location", "service", "tool")
    description = "Google Places API nearbySearch"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = GmapsNearbyPlacesParams
    Output = GmapsNearbyPlacesOutput

    @Operation("nearby", cost={"service": "google_maps", "action": "places_nearby", "count": 1})
    async def nearby(self, ctx: NodeContext, params: GmapsNearbyPlacesParams) -> Any:
        from core.container import container
        from services.handlers.utility import handle_nearby_places

        maps_service = container.maps_service()
        response = await handle_nearby_places(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True),
            context=ctx.raw, maps_service=maps_service,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Nearby places failed")
