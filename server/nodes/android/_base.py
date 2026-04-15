"""Shared base for Android service plugins.

16 Android nodes (battery, network, wifi, bluetooth, audio, camera, …)
all dispatch through the same ``handle_android_service`` handler with
the node_type as the service ID. Subclass + set 5 attrs to mint a new
one. ``android_service`` is fetched from the DI container at call
time — Android relay client is process-singleton.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class AndroidServiceParams(BaseModel):
    action: str = Field(default="status", description="Service action to invoke")
    parameters: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class AndroidServiceOutput(BaseModel):
    success: Optional[bool] = None
    data: Optional[Any] = None

    model_config = ConfigDict(extra="allow")


class AndroidServiceBase(ActionNode, abstract=True):
    """Subclass and set type/display_name/icon/description."""

    color = "#50fa7b"
    group = ("android", "service")
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.ANDROID
    usable_as_tool = True

    Params = AndroidServiceParams
    Output = AndroidServiceOutput

    @Operation("invoke", cost={"service": "android", "action": "service_call", "count": 1})
    async def invoke(self, ctx: NodeContext, params: AndroidServiceParams) -> Any:
        from core.container import container
        from services.handlers.android import handle_android_service

        android_service = container.android_service()
        payload = params.model_dump()
        response = await handle_android_service(
            android_service=android_service,
            node_id=ctx.node_id,
            node_type=self.type,
            parameters=payload,
            context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or f"{self.type} failed")
