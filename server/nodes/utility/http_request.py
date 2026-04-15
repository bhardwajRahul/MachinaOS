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
        """Inlined from handlers/http.py (Wave 11.D.3).

        Supports transparent proxy injection via ``useProxy`` — when
        enabled, the ProxyService picks a provider and returns a
        proxy URL; failures fall back to a direct request.
        """
        import json as json_module
        from core.logging import get_logger
        import httpx

        log = get_logger(__name__)
        if not params.url:
            raise RuntimeError("URL is required")

        proxy_url = await _resolve_proxy_url(params.url, params.use_proxy,
                                              params.model_dump(by_alias=True))
        log.info("[HTTP Request] Executing", node_id=ctx.node_id,
                 method=params.method, url=params.url, proxy=bool(proxy_url))

        client_kwargs: dict = {"timeout": float(params.timeout)}
        if proxy_url:
            client_kwargs["proxy"] = proxy_url

        async with httpx.AsyncClient(**client_kwargs) as client:
            kwargs: dict = {
                "method": params.method,
                "url": params.url,
                "headers": params.headers,
            }
            body = params.body
            if params.method in ("POST", "PUT", "PATCH") and body is not None:
                if isinstance(body, str):
                    try:
                        kwargs["json"] = json_module.loads(body)
                    except json_module.JSONDecodeError:
                        kwargs["content"] = body
                else:
                    kwargs["json"] = body

            response = await client.request(**kwargs)
            try:
                response_data = response.json()
            except Exception:
                response_data = response.text

        result = {
            "status": response.status_code,
            "data": response_data,
            "headers": dict(response.headers),
            "url": str(response.url),
            "method": params.method,
            "proxied": proxy_url is not None,
        }
        if response.status_code >= 400:
            raise RuntimeError(f"HTTP {response.status_code}: {response_data!r}")
        return result


async def _resolve_proxy_url(url: str, use_proxy: bool, parameters: dict) -> Any:
    """Return a proxy URL if ``use_proxy`` is True and a provider is
    configured; otherwise None. Exceptions are swallowed so the
    request proceeds without a proxy."""
    from core.logging import get_logger

    if not use_proxy:
        return None
    try:
        from services.proxy.service import get_proxy_service
        svc = get_proxy_service()
        if not svc or not svc.is_enabled():
            return None
        return await svc.get_proxy_url(url, parameters)
    except Exception as e:
        get_logger(__name__).warning(
            "Proxy URL lookup failed, proceeding without proxy", error=str(e),
        )
        return None
