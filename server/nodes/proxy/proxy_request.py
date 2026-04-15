"""Proxy Request — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ProxyRequestParams(BaseModel):
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = "GET"
    url: str = Field(...)
    headers: Dict[str, str] = Field(default_factory=dict)
    body: Optional[Any] = None
    timeout: int = Field(default=30, ge=1, le=600)
    proxy_provider: str = Field(default="auto", alias="proxyProvider")
    proxy_country: str = Field(default="", alias="proxyCountry")
    session_type: Literal["rotating", "sticky"] = Field(default="rotating", alias="sessionType")
    sticky_duration: int = Field(default=600, alias="stickyDuration", ge=1)
    max_retries: int = Field(default=3, alias="maxRetries", ge=0, le=10)
    follow_redirects: bool = Field(default=True, alias="followRedirects")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ProxyRequestOutput(BaseModel):
    status: Optional[int] = None
    body: Optional[Any] = None
    proxy_used: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ProxyRequestNode(ActionNode):
    type = "proxyRequest"
    display_name = "Proxy Request"
    subtitle = "Routed HTTP"
    icon = "🛡"
    color = "#ffb86c"
    group = ("proxy",)
    description = "Make HTTP requests through residential proxy providers"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.REST_API

    Params = ProxyRequestParams
    Output = ProxyRequestOutput

    @Operation("request")
    async def request(self, ctx: NodeContext, params: ProxyRequestParams) -> Any:
        from services.handlers.proxy import handle_proxy_request
        response = await handle_proxy_request(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Proxy request failed")
