"""Webhook Response — Wave 11.C migration. Reads connected_outputs."""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class WebhookResponseParams(BaseModel):
    status_code: int = Field(default=200, alias="statusCode", ge=100, le=599)
    body: Any = Field(default=None)
    headers: Dict[str, str] = Field(default_factory=dict)
    content_type: str = Field(default="application/json", alias="contentType")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class WebhookResponseOutput(BaseModel):
    sent: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class WebhookResponseNode(ActionNode):
    type = "webhookResponse"
    display_name = "Webhook Response"
    subtitle = "HTTP Reply"
    icon = "↩️"
    color = "#bd93f9"
    group = ("utility",)
    description = "Send custom response back to webhook caller with configurable status code, body, and headers"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.REST_API

    Params = WebhookResponseParams
    Output = WebhookResponseOutput

    @Operation("respond")
    async def respond(self, ctx: NodeContext, params: WebhookResponseParams) -> Any:
        from services.handlers.http import handle_webhook_response
        outputs = ctx.raw.get("connected_outputs") or {}
        response = await handle_webhook_response(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True),
            context=ctx.raw, connected_outputs=outputs,
        )
        if response.get("success") is False:
            raise RuntimeError(response.get("error") or "Webhook response failed")
        return response.get("result") or {}
