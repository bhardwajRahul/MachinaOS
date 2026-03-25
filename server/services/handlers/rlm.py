"""RLM agent handler -- thin wrapper following handle_chat_agent pattern.

Reference: docs-internal/specialized_agent_node_creation.md (Step 5)
"""

from typing import Dict, Any, TYPE_CHECKING
from core.logging import get_logger

if TYPE_CHECKING:
    from services.ai import AIService
    from core.database import Database

logger = get_logger(__name__)


async def handle_rlm_agent(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    ai_service: "AIService",
    database: "Database",
) -> Dict[str, Any]:
    """Handle RLM agent node execution.

    Follows handle_chat_agent pattern (handlers/ai.py:469-564):
    1. _collect_agent_connections()       [REUSE]
    2. _format_task_context()             [REUSE]
    3. Tool stripping on task completion  [REUSE]
    4. Auto-prompt fallback               [REUSE]
    5. Delegate to RLMService.execute()
    """
    from .ai import _collect_agent_connections, _format_task_context
    from services.status_broadcaster import get_status_broadcaster

    workflow_id = context.get('workflow_id')

    # 1. Collect connections (handlers/ai.py:17)
    memory_data, skill_data, tool_data, input_data, task_data = await _collect_agent_connections(
        node_id, context, database, log_prefix="[RLM Agent]"
    )

    # 2. Task context injection (handlers/ai.py:352)
    if task_data:
        task_context = _format_task_context(task_data)
        original_prompt = parameters.get('prompt', '')
        parameters = {**parameters, 'prompt': f"{task_context}\n\n{original_prompt}"}
        logger.info(f"[RLM Agent] Task context injected for task_id={task_data.get('task_id')}")

        # 3. Tool stripping on task completion (handlers/ai.py:514-519)
        task_status = task_data.get('status', '')
        if task_status in ('completed', 'error') and tool_data:
            tool_data = []
            logger.info("[RLM Agent] Stripped tools for task completion handling")

    # 4. Auto-prompt fallback (handlers/ai.py:522-530)
    if not parameters.get('prompt') and input_data:
        prompt = (
            input_data.get('message') or
            input_data.get('text') or
            input_data.get('content') or
            str(input_data)
        )
        parameters = {**parameters, 'prompt': prompt}
        logger.info("[RLM Agent] Auto-using input as prompt")

    # 5. Delegate to RLM service
    broadcaster = get_status_broadcaster()
    return await ai_service.rlm_service.execute(
        node_id, parameters,
        memory_data=memory_data,
        skill_data=skill_data if skill_data else None,
        tool_data=tool_data if tool_data else None,
        broadcaster=broadcaster,
        workflow_id=workflow_id,
        context=context,
        database=database,
    )
