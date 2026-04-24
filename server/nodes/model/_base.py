"""Shared base for chat-model plugins.

8 providers (openai / anthropic / openrouter / groq / cerebras /
deepseek / kimi / mistral) all delegate to ``handle_ai_chat_model`` —
only the type / display_name / icon / colour / description vary.
Per-provider tuning fields (top_k, safety_settings, thinking_budget,
reasoning_effort, reasoning_format) are set on the per-provider Params
when relevant; the union from ``models/nodes.py`` is pre-existing and
can be re-used.

Each provider gets its own file under ``nodes/model/`` so the path
matches the palette grouping; this base lives in ``_base.py`` (private).
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ChatModelParams(BaseModel):
    """Shared params surface — providers override fields where their
    capabilities differ (e.g. fixed temperature for o-series, no
    thinking for openrouter passthrough)."""

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
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens", ge=1, le=200000)
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

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ChatModelOutput(BaseModel):
    response: Optional[str] = None
    thinking: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    finish_reason: Optional[str] = None
    timestamp: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ChatModelBase(ActionNode, abstract=True):
    """Subclass and set type/display_name/icon/color/description.
    Override Params to add provider-specific tuning fields."""

    component_kind = "model"
    handles = (
        {"name": "output-model", "kind": "output", "position": "right",
         "label": "Model", "role": "model"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = ChatModelParams
    Output = ChatModelOutput

    @Operation("chat", cost={"service": "chat_model", "action": "chat", "count": 1})
    async def chat(self, ctx: NodeContext, params: ChatModelParams) -> Any:
        from constants import detect_ai_provider
        from core.container import container

        ai_service = container.ai_service()
        payload = params.model_dump(by_alias=True)

        # Pre-refactor contract: NodeExecutor._inject_api_keys fetched the
        # key from auth_service and wrote it into the params dict under
        # the snake_case `api_key` key. Preserve that wire format so
        # downstream execute_chat + telemetry see the resolved credential
        # in the same place it always lived. Fetch missing, then mirror
        # the aliased form into snake_case.
        if not payload.get("api_key") and not payload.get("apiKey"):
            provider = detect_ai_provider(self.type, payload)
            try:
                resolved = await ai_service.auth.get_api_key(provider)
            except Exception:
                resolved = None
            if resolved:
                payload["api_key"] = resolved
                payload["apiKey"] = resolved
        elif payload.get("apiKey") and not payload.get("api_key"):
            # Pydantic emitted the camelCase alias; ensure snake_case also set.
            payload["api_key"] = payload["apiKey"]

        response = await ai_service.execute_chat(ctx.node_id, self.type, payload)
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or f"{self.type} chat failed")
