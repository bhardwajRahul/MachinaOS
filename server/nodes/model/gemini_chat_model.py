"""Gemini Chat Model — Wave 11.C migration.

Per-provider chat-model plugin. Replaces the cross-provider
``AIChatModelParams`` discriminated union for *this provider only* —
gemini-specific knobs (top_k, safety_settings, thinking_budget) live
in this Params model. Other providers get their own plugins as 11.C
continues.

Delegates execution to the existing ``AIService.execute_chat`` via
``handlers.ai.handle_ai_chat_model`` — that body owns the native
SDK + LangChain dual-path for thinking/streaming/usage-tracking.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class GeminiChatModelParams(BaseModel):
    prompt: str = Field(
        default="",
        json_schema_extra={"rows": 4, "placeholder": "{{ $json.message }}"},
    )
    model: str = Field(
        default="",
        json_schema_extra={"placeholder": "Select a model..."},
    )
    temperature: float = Field(
        default=0.7, ge=0.0, le=2.0,
        json_schema_extra={"numberStepSize": 0.1},
    )
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens", ge=1, le=128000)
    system_prompt: Optional[str] = Field(
        default="", alias="systemMessage",
        json_schema_extra={"rows": 3, "placeholder": "You are a helpful assistant."},
    )
    api_key: Optional[str] = Field(
        default=None, alias="apiKey",
        json_schema_extra={"password": True},
    )
    top_p: Optional[float] = Field(
        default=1.0, alias="topP", ge=0.0, le=1.0,
        json_schema_extra={"numberStepSize": 0.1},
    )
    top_k: Optional[int] = Field(default=40, alias="topK", ge=1, le=100)
    safety_settings: Literal["default", "strict", "permissive"] = Field(
        default="default", alias="safetySettings",
    )
    thinking_enabled: bool = Field(default=False, alias="thinkingEnabled")
    thinking_budget: Optional[int] = Field(
        default=2048, alias="thinkingBudget", ge=1024, le=16000,
        json_schema_extra={"displayOptions": {"show": {"thinking_enabled": [True]}}},
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class GeminiChatModelOutput(BaseModel):
    response: Optional[str] = None
    thinking: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    finish_reason: Optional[str] = None
    timestamp: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class GeminiChatModelNode(ActionNode):
    type = "geminiChatModel"
    display_name = "Gemini"
    subtitle = "Chat Model"
    icon = "lobehub:gemini"
    color = "#4285F4"
    group = ("model",)
    description = "Google Gemini models for multimodal AI capabilities"
    component_kind = "model"
    handles = (
        {"name": "output-model", "kind": "output", "position": "right",
         "label": "Model", "role": "model"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = GeminiChatModelParams
    Output = GeminiChatModelOutput

    @Operation("chat", cost={"service": "gemini", "action": "chat", "count": 1})
    async def chat(self, ctx: NodeContext, params: GeminiChatModelParams) -> Any:
        # Delegate to the legacy chat-model handler; AIService is a
        # singleton retrievable from the DI container.
        from core.container import container
        from services.handlers.ai import handle_ai_chat_model

        ai_service = container.ai_service()
        payload = params.model_dump(by_alias=True)
        response = await handle_ai_chat_model(
            ai_service=ai_service,
            node_id=ctx.node_id,
            node_type=self.type,
            parameters=payload,
            context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Gemini chat failed")
