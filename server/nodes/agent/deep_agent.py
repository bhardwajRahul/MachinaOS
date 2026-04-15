"""Deep Agent — LangChain DeepAgents with FS tools + sub-agent delegation.

Distinct execute path: routes through ``handlers/deep_agent.handle_deep_agent``
rather than the generic ``handle_chat_agent``. Different bottom-handle
ordering (Skill / Team / Tool) for the team-delegation UX.
"""

from __future__ import annotations

from typing import Any

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._handles import STD_AGENT_HINTS, deep_agent_handles
from ._specialized import SpecializedAgentOutput, SpecializedAgentParams


class DeepAgentNode(ActionNode):
    type = "deep_agent"
    display_name = "Deep Agent"
    subtitle = "LangChain DeepAgents"
    icon = "\U0001F9E0"
    color = "#50fa7b"
    group = ("agent",)
    description = "LangChain DeepAgents with filesystem tools and sub-agent delegation"
    component_kind = "agent"
    handles = deep_agent_handles()
    ui_hints = STD_AGENT_HINTS
    annotations = {"destructive": True, "readonly": False, "open_world": True}
    task_queue = TaskQueue.AI_HEAVY

    Params = SpecializedAgentParams
    Output = SpecializedAgentOutput

    @Operation("execute", cost={"service": "deep_agent", "action": "run", "count": 1})
    async def execute_op(self, ctx: NodeContext, params: SpecializedAgentParams) -> Any:
        from core.container import container
        from services.handlers.deep_agent import handle_deep_agent

        ai_service = container.ai_service()
        database = container.database()
        payload = params.model_dump(by_alias=True)
        response = await handle_deep_agent(
            ai_service=ai_service,
            database=database,
            node_id=ctx.node_id,
            node_type=self.type,
            parameters=payload,
            context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "deep_agent execution failed")
