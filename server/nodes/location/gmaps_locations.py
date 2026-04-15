"""Google Maps Geocoding — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from credentials.google_maps import GoogleMapsCredential


class GmapsLocationsParams(BaseModel):
    address: str = Field(..., min_length=1)
    region: str = Field(default="")

    model_config = ConfigDict(extra="ignore")


class GmapsLocationsOutput(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    formatted_address: Optional[str] = None
    place_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class GmapsLocationsNode(ActionNode):
    type = "gmaps_locations"
    display_name = "Geocoding"
    subtitle = "Address \u2192 LatLng"
    icon = "📍"
    color = "#50fa7b"
    group = ("location", "service", "tool")
    description = "Google Maps Geocoding service"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    credentials = (GoogleMapsCredential,)
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = GmapsLocationsParams
    Output = GmapsLocationsOutput

    @Operation("geocode", cost={"service": "google_maps", "action": "geocode", "count": 1})
    async def geocode(self, ctx: NodeContext, params: GmapsLocationsParams) -> Any:
        from core.container import container

        maps_service = container.maps_service()
        response = await maps_service.geocode_location(
            ctx.node_id, params.model_dump(by_alias=True), ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Geocoding failed")
