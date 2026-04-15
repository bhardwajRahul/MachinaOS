"""Embedding Generator — Wave 11.D.7 inlined."""

from __future__ import annotations

import asyncio
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class EmbeddingGeneratorParams(BaseModel):
    chunks: List[Optional[dict]] = Field(default_factory=list)
    provider: Literal["huggingface", "openai", "ollama"] = "huggingface"
    model: str = Field(default="BAAI/bge-small-en-v1.5")
    api_key: str = Field(default="", alias="apiKey")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class EmbeddingGeneratorOutput(BaseModel):
    embeddings: Optional[list] = None
    embedding_count: Optional[int] = None
    dimensions: Optional[int] = None
    chunks: Optional[list] = None
    provider: Optional[str] = None
    model: Optional[str] = None

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
    async def embed(self, ctx: NodeContext, params: EmbeddingGeneratorParams) -> EmbeddingGeneratorOutput:
        p = params.model_dump(by_alias=True)
        chunks = p.get('chunks', [])
        provider = p.get('provider', 'huggingface')
        model = p.get('model', 'BAAI/bge-small-en-v1.5')
        api_key = p.get('apiKey', '')

        if not chunks:
            return EmbeddingGeneratorOutput(
                embeddings=[], embedding_count=0, dimensions=0, chunks=[],
                provider=provider, model=model,
            )

        texts = [c.get('content', '') if isinstance(c, dict) else str(c) for c in chunks]

        if provider == 'huggingface':
            try:
                from langchain_huggingface import HuggingFaceEmbeddings
            except ImportError:
                raise RuntimeError(
                    "HuggingFace embeddings unavailable. "
                    "pip install langchain-huggingface sentence-transformers",
                )
            embedder = HuggingFaceEmbeddings(model_name=model)
        elif provider == 'openai':
            from langchain_openai import OpenAIEmbeddings
            embedder = OpenAIEmbeddings(model=model, api_key=api_key)
        elif provider == 'ollama':
            from langchain_ollama import OllamaEmbeddings
            embedder = OllamaEmbeddings(model=model)
        else:
            raise RuntimeError(f"Unknown provider: {provider}")

        embeddings = await asyncio.to_thread(embedder.embed_documents, texts)
        dimensions = len(embeddings[0]) if embeddings else 0

        return EmbeddingGeneratorOutput(
            embeddings=embeddings,
            embedding_count=len(embeddings),
            dimensions=dimensions,
            chunks=chunks,
            provider=provider,
            model=model,
        )
