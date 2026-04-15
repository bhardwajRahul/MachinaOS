"""AI Agent — Wave 11.C migration (LangGraph agent).

Tool-calling LangGraph agent with memory, skills, and iterative
reasoning. Delegates execution to ``handlers/ai.handle_ai_agent`` —
that body owns the LangGraph graph construction + tool binding +
streaming + memory persistence + delegation.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._handles import STD_AGENT_HINTS, std_agent_handles


class AIAgentParams(BaseModel):
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
    temperature: float = Field(
        default=0.7, ge=0.0, le=2.0,
        json_schema_extra={"numberStepSize": 0.1},
    )
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens", ge=1, le=200000)
    system_message: Optional[str] = Field(
        default="You are a helpful assistant",
        alias="systemMessage",
        json_schema_extra={"rows": 3},
    )
    api_key: Optional[str] = Field(
        default=None, alias="apiKey",
        json_schema_extra={"password": True},
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class AIAgentOutput(BaseModel):
    response: Optional[str] = None
    thinking: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    finish_reason: Optional[str] = None
    timestamp: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class AIAgentNode(ActionNode):
    type = "aiAgent"
    display_name = "AI Agent"
    subtitle = "LangGraph Agent"
    icon = "🤖"
    color = "#bd93f9"
    group = ("agent",)
    description = "LangGraph agent with tool calling, memory, and iterative reasoning"
    component_kind = "agent"
    handles = std_agent_handles()
    ui_hints = STD_AGENT_HINTS
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = AIAgentParams
    Output = AIAgentOutput

    @Operation("execute", cost={"service": "ai_agent", "action": "run", "count": 1})
    async def execute_op(self, ctx: NodeContext, params: AIAgentParams) -> Any:
        from core.container import container
        from services.handlers.ai import handle_ai_agent

        ai_service = container.ai_service()
        database = container.database()
        payload = params.model_dump(by_alias=True)
        response = await handle_ai_agent(
            ai_service=ai_service,
            database=database,
            node_id=ctx.node_id,
            node_type=self.type,
            parameters=payload,
            context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "AI Agent execution failed")
