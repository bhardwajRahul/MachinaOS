"""Vector Store — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._helpers import delegate


class VectorStoreParams(BaseModel):
    operation: Literal["store", "query", "delete"] = "store"
    backend: Literal["chromadb", "qdrant", "pinecone"] = "chromadb"
    collection: str = Field(default="default")
    embeddings: Optional[list] = None
    query: str = Field(default="")
    top_k: int = Field(default=5, alias="topK", ge=1, le=100)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class VectorStoreOutput(BaseModel):
    operation: Optional[str] = None
    matches: Optional[list] = None
    stored_count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class VectorStoreNode(ActionNode):
    type = "vectorStore"
    display_name = "Vector Store"
    subtitle = "Store/Query"
    icon = "🗄"
    color = "#bd93f9"
    group = ("document",)
    description = "Store and query vector embeddings"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = VectorStoreParams
    Output = VectorStoreOutput

    @Operation("dispatch")
    async def dispatch(self, ctx: NodeContext, params: VectorStoreParams) -> Any:
        from services.handlers.document import handle_vector_store
        return await delegate(
            handle_vector_store, node_type=self.type, node_id=ctx.node_id,
            payload=params.model_dump(by_alias=True), context=ctx.raw,
        )
