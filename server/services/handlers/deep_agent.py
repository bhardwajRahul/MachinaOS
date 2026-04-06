"""Deep Agent handler -- thin wrapper following handle_rlm_agent pattern.

Collects connections, builds tools, delegates to DeepAgentService.
"""

from typing import Dict, Any, TYPE_CHECKING
from core.logging import get_logger

if TYPE_CHECKING:
    from services.ai import AIService
    from core.database import Database

logger = get_logger(__name__)


async def handle_deep_agent(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    ai_service: "AIService",
    database: "Database",
) -> Dict[str, Any]:
    """Handle Deep Agent node execution.

    Follows handle_rlm_agent pattern:
    1. _collect_agent_connections()          [REUSE]
    2. _collect_teammate_connections()       [REUSE]
    3. _format_task_context()                [REUSE]
    4. Tool stripping on task completion     [REUSE]
    5. Auto-prompt fallback                  [REUSE]
    6. Build LangChain tools from tool_data  [ai_service._build_tool_from_node]
    7. Delegate to DeepAgentService.execute()
    """
    from .ai import _collect_agent_connections, _collect_teammate_connections, _format_task_context
    from services.status_broadcaster import get_status_broadcaster

    workflow_id = context.get('workflow_id')

    # 1. Collect connections
    memory_data, skill_data, tool_data, input_data, task_data = await _collect_agent_connections(
        node_id, context, database, log_prefix="[Deep Agent]"
    )

    # 2. Task context injection
    if task_data:
        task_context = _format_task_context(task_data)
        original_prompt = parameters.get('prompt', '')
        parameters = {**parameters, 'prompt': f"{task_context}\n\n{original_prompt}"}

        task_status = task_data.get('status', '')
        if task_status in ('completed', 'error') and tool_data:
            tool_data = []

    # 3. Auto-prompt fallback
    if not parameters.get('prompt') and input_data:
        prompt = (
            input_data.get('message') or
            input_data.get('text') or
            input_data.get('content') or
            str(input_data)
        )
        parameters = {**parameters, 'prompt': prompt}

    # 4. Build LangChain tools from connected tool nodes
    built_tools = []
    if tool_data:
        for tool_info in tool_data:
            try:
                tool, _config = await ai_service._build_tool_from_node(tool_info)
                if tool:
                    built_tools.append(tool)
            except Exception as e:
                logger.warning("[Deep Agent] Failed to build tool from %s: %s",
                               tool_info.get("node_type"), e)

    # 5. Collect teammates for sub-agent delegation
    teammates = await _collect_teammate_connections(node_id, context, database)

    # 6. Delegate to DeepAgentService
    broadcaster = get_status_broadcaster()
    return await ai_service.deep_agent_service.execute(
        node_id, parameters,
        skill_data=skill_data if skill_data else None,
        tools=built_tools if built_tools else None,
        teammates=teammates if teammates else None,
        broadcaster=broadcaster,
        workflow_id=workflow_id,
        database=database,
    )
