"""HTTP Request — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class HttpRequestParams(BaseModel):
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = "GET"
    url: str = Field(...)
    headers: Dict[str, str] = Field(default_factory=dict)
    body: Optional[Any] = None
    timeout: int = Field(default=30, ge=1, le=600)
    use_proxy: bool = Field(default=False, alias="useProxy")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class HttpRequestOutput(BaseModel):
    status: Optional[int] = None
    headers: Optional[dict] = None
    body: Optional[Any] = None

    model_config = ConfigDict(extra="allow")


class HttpRequestNode(ActionNode):
    type = "httpRequest"
    display_name = "HTTP Request"
    subtitle = "REST Call"
    icon = "🌐"
    color = "#bd93f9"
    group = ("utility", "tool")
    description = "Make HTTP requests to external APIs (GET, POST, PUT, DELETE, PATCH)"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = HttpRequestParams
    Output = HttpRequestOutput

    @Operation("request")
    async def request(self, ctx: NodeContext, params: HttpRequestParams) -> Any:
        from services.handlers.http import handle_http_request
        response = await handle_http_request(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "HTTP request failed")
