"""Text Generator — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class TextGeneratorParams(BaseModel):
    source: Literal["static", "ai", "file", "api"] = "static"
    text: str = Field(default="", json_schema_extra={"rows": 4})
    file_path: str = Field(default="", alias="filePath")
    api_url: str = Field(default="", alias="apiUrl")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class TextGeneratorOutput(BaseModel):
    text: Optional[str] = None
    source: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class TextGeneratorNode(ActionNode):
    type = "textGenerator"
    display_name = "Text Generator"
    subtitle = "Static / AI Text"
    icon = "📝"
    color = "#bd93f9"
    group = ("text",)
    description = "Generate text using static, AI, file, or API source"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.DEFAULT

    Params = TextGeneratorParams
    Output = TextGeneratorOutput

    @Operation("generate")
    async def generate(self, ctx: NodeContext, params: TextGeneratorParams) -> Any:
        from core.container import container
        from services.handlers.utility import handle_text_generator

        text_service = container.text_service()
        response = await handle_text_generator(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True),
            context=ctx.raw, text_service=text_service,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Text generator failed")
