"""Claude Code Agent handler."""

import time
from datetime import datetime
from typing import Any, Dict

from core.logging import get_logger
from services.status_broadcaster import get_status_broadcaster
from services.claude_code_service import get_claude_code_service

logger = get_logger(__name__)


async def handle_claude_code_agent(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    ai_service=None,
    database=None,
) -> Dict[str, Any]:
    """Execute task via Claude Code CLI."""
    start_time = time.time()
    broadcaster = get_status_broadcaster()
    workflow_id = context.get("workflow_id")

    await broadcaster.update_node_status(
        node_id, "executing", {"message": "Starting Claude Code..."}, workflow_id=workflow_id
    )

    try:
        # Resolve prompt from params or connected input
        prompt = parameters.get("prompt", "")
        if not prompt:
            for edge in context.get("edges", []):
                if edge.get("target") == node_id and edge.get("targetHandle") in ("input-main", None):
                    src = context.get("outputs", {}).get(edge.get("source"), {})
                    if isinstance(src, dict):
                        prompt = src.get("message") or src.get("text") or src.get("content") or str(src)
                    elif src:
                        prompt = str(src)
                    if prompt:
                        break

        if not prompt:
            return {"success": False, "node_id": node_id, "error": "No prompt provided", "execution_time": time.time() - start_time}

        # Collect skill instructions
        from services.handlers.ai import _collect_agent_connections
        _, skill_data, _, _, _ = await _collect_agent_connections(node_id, context, database)

        system_parts = []
        if parameters.get("systemPrompt"):
            system_parts.append(parameters["systemPrompt"])
        for skill in skill_data:
            instr = skill.get("parameters", {}).get("instructions", "")
            if instr:
                system_parts.append(instr)

        model = parameters.get("model", "claude-sonnet-4-6")
        await broadcaster.update_node_status(
            node_id, "executing", {"message": f"Running Claude Code ({model})..."}, workflow_id=workflow_id
        )

        service = get_claude_code_service()
        data = await service.execute(
            prompt=prompt,
            node_id=node_id,
            model=model,
            cwd=parameters.get("workingDirectory") or None,
            allowed_tools=parameters.get("allowedTools", "Read,Edit,Bash,Glob,Grep,Write"),
            max_turns=int(parameters.get("maxTurns", 10)),
            max_budget_usd=float(parameters.get("maxBudgetUsd", 5.0)),
            system_prompt="\n\n".join(system_parts) if system_parts else None,
        )

        execution_time = time.time() - start_time
        await broadcaster.update_node_status(node_id, "success", {"message": "Claude Code completed"}, workflow_id=workflow_id)

        return {
            "success": True,
            "node_id": node_id,
            "node_type": node_type,
            "result": {
                "response": data.get("result", ""),
                "model": model,
                "provider": "anthropic",
                "session_id": data.get("session_id", ""),
                "usage": data.get("usage", {}),
                "timestamp": datetime.now().isoformat(),
            },
            "execution_time": execution_time,
        }

    except Exception as e:
        logger.error("Claude Code error for node %s: %s", node_id, e)
        return {"success": False, "node_id": node_id, "error": str(e), "execution_time": time.time() - start_time}
