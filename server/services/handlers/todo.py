"""Write Todos handler -- manages structured task lists for AI agents.

Dual-purpose: works as a workflow node (handle_write_todos) and as an
AI Agent tool (execute_write_todos). Follows the pattern of browser.py,
search.py, etc. Delegates state management to TodoService.
"""

from typing import Any, Dict

from core.logging import get_logger
from services.todo_service import get_todo_service

logger = get_logger(__name__)


async def handle_write_todos(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Handle writeTodos as a workflow node.

    Standard workflow handler signature matching node_executor registry.
    """
    config = {
        "node_id": node_id,
        "workflow_id": context.get("workflow_id", ""),
        "broadcaster": context.get("broadcaster"),
    }
    return await execute_write_todos(parameters, config)


async def execute_write_todos(
    tool_args: Dict[str, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Execute write_todos tool call from AI Agent.

    Args:
        tool_args: LLM-provided args matching WriteTodosSchema.
        config: Tool config (node_id, workflow_id, broadcaster, etc.)

    Returns:
        Dict with JSON-formatted todo list for LLM.
    """
    todos_input = tool_args.get("todos", [])
    workflow_id = config.get("workflow_id", "")
    node_id = config.get("node_id", "")
    broadcaster = config.get("broadcaster")

    session_key = workflow_id or node_id or "default"

    service = get_todo_service()
    stored = service.write(session_key, todos_input)

    # Broadcast todo update for real-time UI
    if broadcaster and node_id:
        await broadcaster.update_node_status(
            node_id,
            "executing",
            {"phase": "todo_update", "todos": stored},
            workflow_id=workflow_id,
        )

    logger.info("[WriteTodos] Updated %d todos (session=%s)", len(stored), session_key)

    return {
        "success": True,
        "message": f"Updated todo list ({len(stored)} items)",
        "todos": service.format_for_llm(session_key),
        "count": len(stored),
    }
