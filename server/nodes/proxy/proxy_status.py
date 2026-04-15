"""Proxy Status — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ProxyStatusParams(BaseModel):
    provider_name: str = Field(default="", alias="providerName")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ProxyStatusOutput(BaseModel):
    providers: Optional[list] = None
    stats: Optional[dict] = None

    model_config = ConfigDict(extra="allow")


class ProxyStatusNode(ActionNode):
    type = "proxyStatus"
    display_name = "Proxy Status"
    subtitle = "Health Stats"
    icon = "📊"
    color = "#ffb86c"
    group = ("proxy",)
    description = "View proxy provider health, scores, and usage statistics"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = ProxyStatusParams
    Output = ProxyStatusOutput

    @Operation("status")
    async def status(self, ctx: NodeContext, params: ProxyStatusParams) -> Any:
        from services.handlers.proxy import handle_proxy_status
        response = await handle_proxy_status(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Proxy status failed")
