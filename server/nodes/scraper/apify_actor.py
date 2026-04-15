"""Apify Actor — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ApifyActorParams(BaseModel):
    actor_id: str = Field(..., alias="actorId")
    actor_input: Dict[str, Any] = Field(default_factory=dict, alias="actorInput")
    max_results: int = Field(default=20, alias="maxResults", ge=1, le=10000)
    timeout: int = Field(default=300, ge=1, le=3600)
    memory: int = Field(default=512, ge=128, le=8192)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ApifyActorOutput(BaseModel):
    items: Optional[list] = None
    count: Optional[int] = None
    run_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ApifyActorNode(ActionNode):
    type = "apifyActor"
    display_name = "Apify Actor"
    subtitle = "Web Scraper"
    icon = "asset:apify"
    color = "#ff79c6"
    group = ("api", "scraper", "tool")
    description = "Run Apify actors for Instagram, TikTok, Twitter, LinkedIn, etc."
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = ApifyActorParams
    Output = ApifyActorOutput

    @Operation("run")
    async def run(self, ctx: NodeContext, params: ApifyActorParams) -> Any:
        from services.handlers.apify import handle_apify_actor
        response = await handle_apify_actor(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Apify run failed")
