"""Embedding Generator — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._helpers import delegate


class EmbeddingGeneratorParams(BaseModel):
    chunks: List[str] = Field(default_factory=list)
    provider: Literal["huggingface", "openai", "ollama"] = "huggingface"
    model: str = Field(default="BAAI/bge-small-en-v1.5")

    model_config = ConfigDict(extra="allow")


class EmbeddingGeneratorOutput(BaseModel):
    embeddings: Optional[list] = None
    dimension: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class EmbeddingGeneratorNode(ActionNode):
    type = "embeddingGenerator"
    display_name = "Embedding Generator"
    subtitle = "Vectorize"
    icon = "🧮"
    color = "#bd93f9"
    group = ("document",)
    description = "Generate vector embeddings from text chunks"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = EmbeddingGeneratorParams
    Output = EmbeddingGeneratorOutput

    @Operation("embed")
    async def embed(self, ctx: NodeContext, params: EmbeddingGeneratorParams) -> Any:
        from services.handlers.document import handle_embedding_generator
        return await delegate(
            handle_embedding_generator, node_type=self.type, node_id=ctx.node_id,
            payload=params.model_dump(by_alias=True), context=ctx.raw,
        )
