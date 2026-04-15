"""Chat Agent (Zeenie) — Wave 11.C migration.

Conversational LangGraph agent with skills + memory. Distinct from
:class:`AIAgentNode` because it uses ``handle_chat_agent`` which
applies a different default system message + skill prompt assembly.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._handles import STD_AGENT_HINTS, std_agent_handles


class ChatAgentParams(BaseModel):
    provider: Literal[
        "openai", "anthropic", "gemini", "openrouter",
        "groq", "cerebras", "deepseek", "kimi", "mistral",
    ] = "openai"
    model: str = Field(
        default="", json_schema_extra={"placeholder": "Select a model..."},
    )
    prompt: str = Field(
        default="",
        json_schema_extra={
            "placeholder": "Optional: leave empty to use connected input",
            "rows": 4,
        },
    )
    system_message: Optional[str] = Field(
        default="", alias="systemMessage", json_schema_extra={"rows": 3},
    )
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=1000, alias="maxTokens", ge=1, le=200000)
    api_key: Optional[str] = Field(
        default=None, alias="apiKey",
        json_schema_extra={"password": True},
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ChatAgentOutput(BaseModel):
    response: Optional[str] = None
    thinking: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    finish_reason: Optional[str] = None
    timestamp: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ChatAgentNode(ActionNode):
    type = "chatAgent"
    display_name = "Zeenie"
    subtitle = "Personal Assistant"
    icon = "🧞"
    color = "#8be9fd"
    group = ("agent",)
    description = "Conversational AI agent with skills and memory"
    component_kind = "agent"
    handles = std_agent_handles()
    ui_hints = STD_AGENT_HINTS
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = ChatAgentParams
    Output = ChatAgentOutput

    @Operation("execute", cost={"service": "chat_agent", "action": "run", "count": 1})
    async def execute_op(self, ctx: NodeContext, params: ChatAgentParams) -> Any:
        """Inlined from handlers/ai.handle_chat_agent (Wave 11.D.6)."""
        from core.container import container

        from ._inline import prepare_agent_call

        ai_service = container.ai_service()
        database = container.database()
        kwargs = await prepare_agent_call(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True),
            context=ctx.raw, database=database,
            log_prefix="[Chat Agent]",
        )
        response = await ai_service.execute_chat_agent(ctx.node_id, **kwargs)
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Chat Agent execution failed")
