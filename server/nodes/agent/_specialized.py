"""Specialized agent base — subclass + set 5 attrs to mint a new agent.

13 specialized agents (android / coding / web / task / social / travel
/ tool / productivity / payments / consumer / autonomous / rlm /
claude_code) all share the LangGraph-via-handle_chat_agent execution
path. The only differences are display name, icon, colour, subtitle,
description. Each agent gets its own file under ``nodes/agent/`` so
the user can find ``android_agent.py`` directly — but the body lives
here so changing the dispatch path is a one-file edit.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._handles import STD_AGENT_HINTS, std_agent_handles


class SpecializedAgentParams(BaseModel):
    """Identical to AIAgentParams — full LLM tuning surface."""

    prompt: str = Field(
        default="",
        json_schema_extra={
            "placeholder": "Enter your prompt or use template variables...",
            "rows": 4,
        },
    )
    provider: Literal[
        "openai", "anthropic", "gemini", "openrouter",
        "groq", "cerebras", "deepseek", "kimi", "mistral",
    ] = "openai"
    model: str = Field(
        default="", json_schema_extra={"placeholder": "Select a model..."},
    )
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens", ge=1, le=200000)
    system_message: Optional[str] = Field(
        default="You are a helpful assistant",
        alias="systemMessage", json_schema_extra={"rows": 3},
    )
    api_key: Optional[str] = Field(
        default=None, alias="apiKey",
        json_schema_extra={"password": True},
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class SpecializedAgentOutput(BaseModel):
    response: Optional[str] = None
    thinking: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    finish_reason: Optional[str] = None
    timestamp: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class SpecializedAgentBase(ActionNode, abstract=True):
    """Subclass and set type/display_name/icon/color/subtitle/description."""

    component_kind = "agent"
    handles = std_agent_handles()
    ui_hints = STD_AGENT_HINTS
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = SpecializedAgentParams
    Output = SpecializedAgentOutput

    @Operation("execute", cost={"service": "specialized_agent", "action": "run", "count": 1})
    async def execute_op(self, ctx: NodeContext, params: SpecializedAgentParams) -> Any:
        """Inlined via ``prepare_agent_call`` (Wave 11.D.6).

        All 13 specialized agents + orchestrator + ai_employee route
        through :func:`AIService.execute_chat_agent` with identical
        pre-dispatch flow. Team-lead teammate injection happens inside
        ``prepare_agent_call`` based on ``self.type``.
        """
        from core.container import container

        from ._inline import prepare_agent_call

        ai_service = container.ai_service()
        database = container.database()
        kwargs = await prepare_agent_call(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True),
            context=ctx.raw, database=database,
            log_prefix=f"[{self.type}]",
        )
        response = await ai_service.execute_chat_agent(ctx.node_id, **kwargs)
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or f"{self.type} execution failed")
