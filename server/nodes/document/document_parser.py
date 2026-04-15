"""Document Parser — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._helpers import delegate


class DocumentParserParams(BaseModel):
    file_path: str = Field(..., alias="filePath")
    parser: Literal["pypdf", "marker", "unstructured", "beautifulsoup"] = "pypdf"

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class DocumentParserOutput(BaseModel):
    text: Optional[str] = None
    pages: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class DocumentParserNode(ActionNode):
    type = "documentParser"
    display_name = "Document Parser"
    subtitle = "Parse to Text"
    icon = "📄"
    color = "#bd93f9"
    group = ("document",)
    description = "Parse documents to text using configurable parsers"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = DocumentParserParams
    Output = DocumentParserOutput

    @Operation("parse")
    async def parse(self, ctx: NodeContext, params: DocumentParserParams) -> Any:
        from services.handlers.document import handle_document_parser
        return await delegate(
            handle_document_parser, node_type=self.type, node_id=ctx.node_id,
            payload=params.model_dump(by_alias=True), context=ctx.raw,
        )
