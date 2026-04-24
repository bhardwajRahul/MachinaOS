"""Claude Code Agent — Wave 11.E.3 inlined.

Shells out to the local ``claude`` CLI binary (isolated auth via
``services/claude_oauth.py``). Status updates broadcast on entry +
exit; skill instructions concatenated into the system prompt.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Optional

from pydantic import ConfigDict, Field

from core.logging import get_logger
from services.plugin import ActionNode, NodeContext, Operation, TaskQueue
from services.plugin.edge_walker import collect_agent_connections

from ._handles import STD_AGENT_HINTS, std_agent_handles
from ._specialized import SpecializedAgentOutput, SpecializedAgentParams

logger = get_logger(__name__)


class ClaudeCodeAgentParams(SpecializedAgentParams):
    """SpecializedAgentParams plus the CLI-specific knobs.

    Pre-refactor handler read these fields from the raw payload
    (maxTurns, maxBudgetUsd, allowedTools, workingDirectory, systemPrompt).
    ``SpecializedAgentParams`` has ``extra="ignore"`` which silently drops
    them, so declaring them restores the pre-refactor contract.
    """

    max_turns: int = Field(default=10, alias="maxTurns", ge=1, le=200)
    max_budget_usd: float = Field(default=5.0, alias="maxBudgetUsd", ge=0.0)
    allowed_tools: str = Field(
        default="Read,Edit,Bash,Glob,Grep,Write", alias="allowedTools",
    )
    working_directory: Optional[str] = Field(default=None, alias="workingDirectory")
    system_prompt: Optional[str] = Field(default=None, alias="systemPrompt")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


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

    Params = ClaudeCodeAgentParams
    Output = SpecializedAgentOutput

    @Operation("execute", cost={"service": "claude_code_agent", "action": "run", "count": 1})
    async def execute_op(self, ctx: NodeContext, params: ClaudeCodeAgentParams) -> Any:
        from core.container import container
        from services.claude_code_service import get_claude_code_service
        from services.status_broadcaster import get_status_broadcaster

        start_time = time.time()
        broadcaster = get_status_broadcaster()
        workflow_id = ctx.workflow_id
        node_id = ctx.node_id
        payload = params.model_dump(by_alias=True)

        await broadcaster.update_node_status(
            node_id, "executing",
            {"message": "Starting Claude Code..."},
            workflow_id=workflow_id,
        )

        # Resolve prompt: explicit param wins; otherwise pull text from
        # the upstream node connected to input-main.
        prompt = payload.get("prompt", "")
        if not prompt:
            for edge in ctx.raw.get("edges", []):
                if edge.get("target") == node_id and edge.get("targetHandle") in ("input-main", None):
                    src = ctx.raw.get("outputs", {}).get(edge.get("source"), {})
                    if isinstance(src, dict):
                        prompt = src.get("message") or src.get("text") or src.get("content") or str(src)
                    elif src:
                        prompt = str(src)
                    if prompt:
                        break
        if not prompt:
            raise RuntimeError("No prompt provided")

        database = container.database()
        _, skill_data, _, _, _ = await collect_agent_connections(node_id, ctx.raw, database)

        system_parts = []
        if payload.get("systemPrompt"):
            system_parts.append(payload["systemPrompt"])
        for skill in skill_data:
            instr = skill.get("parameters", {}).get("instructions", "")
            if instr:
                system_parts.append(instr)

        model = payload.get("model", "claude-sonnet-4-6")
        await broadcaster.update_node_status(
            node_id, "executing",
            {"message": f"Running Claude Code ({model})..."},
            workflow_id=workflow_id,
        )

        service = get_claude_code_service()
        data = await service.execute(
            prompt=prompt,
            node_id=node_id,
            model=model,
            cwd=payload.get("workingDirectory") or None,
            allowed_tools=payload.get("allowedTools", "Read,Edit,Bash,Glob,Grep,Write"),
            max_turns=int(payload.get("maxTurns", 10)),
            max_budget_usd=float(payload.get("maxBudgetUsd", 5.0)),
            system_prompt="\n\n".join(system_parts) if system_parts else None,
        )

        await broadcaster.update_node_status(
            node_id, "success",
            {"message": "Claude Code completed"},
            workflow_id=workflow_id,
        )
        logger.debug("[ClaudeCode] node=%s elapsed=%.2fs", node_id, time.time() - start_time)

        return {
            "response": data.get("result", ""),
            "model": model,
            "provider": "anthropic",
            "session_id": data.get("session_id", ""),
            "usage": data.get("usage", {}),
            "timestamp": datetime.now().isoformat(),
        }
