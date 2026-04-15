"""RLM Agent — Recursive Language Model agent (REPL-based).

Distinct from the standard LangGraph chat agent — uses
``handle_rlm_agent`` which spins a recursive language-model loop
inside a REPL sandbox.
"""

from __future__ import annotations

from typing import Any

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._handles import STD_AGENT_HINTS, std_agent_handles
from ._specialized import SpecializedAgentOutput, SpecializedAgentParams


class RLMAgentNode(ActionNode):
    type = "rlm_agent"
    display_name = "RLM Agent"
    subtitle = "Recursive Reasoning"
    icon = "🧠"
    color = "#ffb86c"
    group = ("agent",)
    description = "Recursive Language Model agent (REPL-based)"
    component_kind = "agent"
    handles = std_agent_handles()
    ui_hints = STD_AGENT_HINTS
    annotations = {"destructive": True, "readonly": False, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = SpecializedAgentParams
    Output = SpecializedAgentOutput

    @Operation("execute", cost={"service": "rlm_agent", "action": "run", "count": 1})
    async def execute_op(self, ctx: NodeContext, params: SpecializedAgentParams) -> Any:
        from core.container import container
        from services.handlers.ai import handle_rlm_agent

        ai_service = container.ai_service()
        database = container.database()
        payload = params.model_dump(by_alias=True)
        response = await handle_rlm_agent(
            ai_service=ai_service,
            database=database,
            node_id=ctx.node_id,
            node_type=self.type,
            parameters=payload,
            context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "rlm_agent execution failed")
