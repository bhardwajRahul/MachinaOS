"""Proxy Config — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ProxyConfigParams(BaseModel):
    operation: Literal[
        "list_providers", "add_provider", "update_provider", "remove_provider",
        "set_credentials", "test_provider", "get_stats",
        "add_routing_rule", "list_routing_rules", "remove_routing_rule",
    ] = "list_providers"
    provider_name: str = Field(default="", alias="providerName")
    config: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ProxyConfigOutput(BaseModel):
    operation: Optional[str] = None
    providers: Optional[list] = None
    rules: Optional[list] = None
    success: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class ProxyConfigNode(ActionNode):
    type = "proxyConfig"
    display_name = "Proxy Config"
    subtitle = "Routing Rules"
    icon = "🔧"
    color = "#ffb86c"
    group = ("proxy", "tool")
    description = "Configure proxy providers and routing rules"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": True, "readonly": False, "open_world": False}
    task_queue = TaskQueue.DEFAULT
    usable_as_tool = True

    Params = ProxyConfigParams
    Output = ProxyConfigOutput

    @Operation("dispatch")
    async def dispatch(self, ctx: NodeContext, params: ProxyConfigParams) -> Any:
        from services.handlers.proxy import handle_proxy_config
        response = await handle_proxy_config(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Proxy config failed")
