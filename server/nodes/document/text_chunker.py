"""Text Chunker — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._helpers import delegate


class TextChunkerParams(BaseModel):
    text: str = Field(default="")
    strategy: Literal["recursive", "markdown", "token"] = "recursive"
    chunk_size: int = Field(default=1000, alias="chunkSize", ge=100, le=8000)
    overlap: int = Field(default=200, ge=0, le=1000)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class TextChunkerOutput(BaseModel):
    chunks: Optional[list] = None
    count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class TextChunkerNode(ActionNode):
    type = "textChunker"
    display_name = "Text Chunker"
    subtitle = "Chunk Text"
    icon = "✂️"
    color = "#bd93f9"
    group = ("document",)
    description = "Split text into overlapping chunks for embedding"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = TextChunkerParams
    Output = TextChunkerOutput

    @Operation("chunk")
    async def chunk(self, ctx: NodeContext, params: TextChunkerParams) -> Any:
        from services.handlers.document import handle_text_chunker
        return await delegate(
            handle_text_chunker, node_type=self.type, node_id=ctx.node_id,
            payload=params.model_dump(by_alias=True), context=ctx.raw,
        )
