"""Claude Code Agent — Claude Code CLI as a specialized agent.

Distinct execute path: routes through ``handle_claude_code_agent``
which shells out to the local ``claude`` CLI binary with isolated auth.
"""

from __future__ import annotations

from typing import Any

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._handles import STD_AGENT_HINTS, std_agent_handles
from ._specialized import SpecializedAgentOutput, SpecializedAgentParams


class ClaudeCodeAgentNode(ActionNode):
    type = "claude_code_agent"
    display_name = "Claude Code"
    subtitle = "Agentic Coding"
    icon = "lobehub:Claude"
    color = "#8be9fd"
    group = ("agent",)
    description = "Claude Code CLI as a specialized agent"
    component_kind = "agent"
    handles = std_agent_handles()
    ui_hints = STD_AGENT_HINTS
    annotations = {"destructive": True, "readonly": False, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = SpecializedAgentParams
    Output = SpecializedAgentOutput

    @Operation("execute", cost={"service": "claude_code_agent", "action": "run", "count": 1})
    async def execute_op(self, ctx: NodeContext, params: SpecializedAgentParams) -> Any:
        from core.container import container
        from services.handlers.ai import handle_claude_code_agent

        ai_service = container.ai_service()
        database = container.database()
        payload = params.model_dump(by_alias=True)
        response = await handle_claude_code_agent(
            ai_service=ai_service,
            database=database,
            node_id=ctx.node_id,
            node_type=self.type,
            parameters=payload,
            context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "claude_code_agent execution failed")
