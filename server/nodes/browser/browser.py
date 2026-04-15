"""Browser — Wave 11.C migration. agent-browser CLI wrapper."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class BrowserParams(BaseModel):
    operation: Literal[
        "navigate", "click", "type", "fill", "screenshot", "snapshot",
        "get_text", "get_html", "eval", "wait", "scroll", "select", "batch",
    ] = "navigate"
    url: str = Field(default="")
    selector: str = Field(default="")
    text: str = Field(default="")
    session: str = Field(default="")

    model_config = ConfigDict(extra="allow")


class BrowserOutput(BaseModel):
    operation: Optional[str] = None
    snapshot: Optional[Any] = None
    text: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class BrowserNode(ActionNode):
    type = "browser"
    display_name = "Browser"
    subtitle = "Browser Automation"
    icon = "asset:chrome"
    color = "#ff79c6"
    group = ("browser", "tool")
    description = "Interactive browser automation via agent-browser CLI"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": True, "readonly": False, "open_world": True}
    task_queue = TaskQueue.BROWSER
    usable_as_tool = True

    Params = BrowserParams
    Output = BrowserOutput

    @Operation("dispatch")
    async def dispatch(self, ctx: NodeContext, params: BrowserParams) -> Any:
        from services.handlers.browser import handle_browser
        response = await handle_browser(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Browser op failed")
