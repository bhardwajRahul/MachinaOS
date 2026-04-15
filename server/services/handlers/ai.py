"""AI node handlers - AI Agent, Zeenie, AI Chat Model, Simple Memory.

Wave 11.D.0: edge-walking helpers (collect_agent_connections,
collect_teammate_connections, format_task_context) moved to
``services/plugin/edge_walker.py``. The three underscore-prefixed
shims below keep this module's public surface intact while
agent plugins migrate to the new import path directly.
"""

from typing import Dict, Any, List, Optional, Tuple, TYPE_CHECKING
from core.logging import get_logger
from constants import ANDROID_SERVICE_NODE_TYPES, AI_AGENT_TYPES
from services.plugin.edge_walker import (
    collect_agent_connections as _ew_collect_agent_connections,
    collect_teammate_connections as _ew_collect_teammate_connections,
    format_task_context as _ew_format_task_context,
)

if TYPE_CHECKING:
    from services.ai import AIService
    from core.database import Database

logger = get_logger(__name__)

# Team lead types that can create teams
TEAM_LEAD_TYPES = {'orchestrator_agent', 'ai_employee'}


async def _collect_agent_connections(
    node_id: str,
    context: Dict[str, Any],
    database: "Database",
    log_prefix: str = "[Agent]",
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Back-compat shim — body moved to ``services/plugin/edge_walker.py``."""
    return await _ew_collect_agent_connections(node_id, context, database, log_prefix)


async def _collect_teammate_connections(
    node_id: str,
    context: Dict[str, Any],
    database: "Database",
) -> List[Dict[str, Any]]:
    """Back-compat shim — body moved to ``services/plugin/edge_walker.py``."""
    return await _ew_collect_teammate_connections(node_id, context, database)


def _format_task_context(task_data: Dict[str, Any]) -> str:
    """Back-compat shim — body moved to ``services/plugin/edge_walker.py``."""
    return _ew_format_task_context(task_data)


# DELETED (Wave 11.D.0): the original inline bodies of
# _collect_agent_connections / _collect_teammate_connections /

async def handle_ai_agent(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    ai_service: "AIService",
    database: "Database"
) -> Dict[str, Any]:
    """Handle AI agent node execution with memory, skill, and tool support.

    Args:
        node_id: The node ID
        node_type: The node type (aiAgent)
        parameters: Resolved parameters
        context: Execution context with nodes, edges, session_id, start_time, execution_id
        ai_service: The AI service instance
        database: The database instance

    Returns:
        Execution result dict
    """
    workflow_id = context.get('workflow_id')

    # Collect connected memory, skill, tool, input, and task nodes using shared base function
    memory_data, skill_data, tool_data, input_data, task_data = await _collect_agent_connections(
        node_id, context, database, log_prefix="[AI Agent]"
    )

    # If task data is present, format it as context for the agent
    if task_data:
        task_context = _format_task_context(task_data)
        original_prompt = parameters.get('prompt', '')
        parameters = {**parameters, 'prompt': f"{task_context}\n\n{original_prompt}"}
        logger.info(f"[AI Agent] Task context injected for task_id={task_data.get('task_id')}")

        # CRITICAL FIX: Strip ALL tools when handling task completion
        # When reporting a delegated task result, the agent should NOT use any tools.
        # Binding tools while instructing "do not use tools" confuses Gemini (returns empty []).
        # The agent's only job is to report the result naturally.
        task_status = task_data.get('status', '')
        if task_status in ('completed', 'error') and tool_data:
            original_tool_count = len(tool_data)
            # Strip ALL tools - agent is just reporting result, not executing anything
            tool_data = []
            logger.info(f"[AI Agent] Stripped ALL {original_tool_count} tools for task completion handling")

    # Auto-use input data if prompt is empty (fallback for trigger nodes)
    if not parameters.get('prompt') and input_data:
        prompt = (
            input_data.get('message') or
            input_data.get('text') or
            input_data.get('content') or
            str(input_data)
        )
        parameters = {**parameters, 'prompt': prompt}
        logger.info(f"[AI Agent] Auto-using input as prompt: {prompt[:100] if len(str(prompt)) > 100 else prompt}...")

    # Get broadcaster for real-time status updates
    from services.status_broadcaster import get_status_broadcaster
    broadcaster = get_status_broadcaster()

    return await ai_service.execute_agent(
        node_id,
        parameters,
        memory_data=memory_data,
        skill_data=skill_data if skill_data else None,
        tool_data=tool_data if tool_data else None,
        broadcaster=broadcaster,
        workflow_id=workflow_id,
        context=context,  # Pass context for nested agent delegation
        database=database  # Pass database for default model lookup
    )


async def handle_chat_agent(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    ai_service: "AIService",
    database: "Database"
) -> Dict[str, Any]:
    """Handle Zeenie node execution with skill-based tool calling.

    Zeenie supports:
    - Memory (input-memory): SimpleMemory node for conversation history
    - Skills (input-skill): Provide context/instructions via SKILL.md
    - Tools (input-tools): Tool nodes (httpRequest, etc.) for LangGraph tool calling
    - Input fallback (input-main or input-chat): Auto-use connected node output as prompt

    Args:
        node_id: The node ID
        node_type: The node type (chatAgent)
        parameters: Resolved parameters
        context: Execution context with nodes, edges, session_id, start_time, execution_id
        ai_service: The AI service instance
        database: The database instance

    Returns:
        Execution result dict
    """
    workflow_id = context.get('workflow_id')

    # Collect connected memory, skill, tool, input, and task nodes using shared base function
    memory_data, skill_data, tool_data, input_data, task_data = await _collect_agent_connections(
        node_id, context, database, log_prefix="[Chat Agent]"
    )

    # If task data is present, format it as context for the agent
    if task_data:
        task_context = _format_task_context(task_data)
        original_prompt = parameters.get('prompt', '')
        parameters = {**parameters, 'prompt': f"{task_context}\n\n{original_prompt}"}
        logger.info(f"[Chat Agent] Task context injected for task_id={task_data.get('task_id')}")

        # CRITICAL FIX: Strip ALL tools when handling task completion
        # When reporting a delegated task result, the agent should NOT use any tools.
        # Binding tools while instructing "do not use tools" confuses Gemini (returns empty []).
        # The agent's only job is to report the result naturally.
        task_status = task_data.get('status', '')
        if task_status in ('completed', 'error') and tool_data:
            original_tool_count = len(tool_data)
            # Strip ALL tools - agent is just reporting result, not executing anything
            tool_data = []
            logger.info(f"[Chat Agent] Stripped ALL {original_tool_count} tools for task completion handling")

    # Auto-use input data if prompt is empty (fallback for trigger nodes)
    if not parameters.get('prompt') and input_data:
        prompt = (
            input_data.get('message') or
            input_data.get('text') or
            input_data.get('content') or
            str(input_data)
        )
        parameters = {**parameters, 'prompt': prompt}
        logger.info(f"[Chat Agent] Auto-using input as prompt: {prompt[:100] if len(str(prompt)) > 100 else prompt}...")

    # Get broadcaster for real-time status updates
    from services.status_broadcaster import get_status_broadcaster
    broadcaster = get_status_broadcaster()

    # Team mode detection for orchestrator_agent and ai_employee nodes
    # Teammates connected via input-teammates become delegation tools
    if node_type in TEAM_LEAD_TYPES:
        teammates = await _collect_teammate_connections(node_id, context, database)

        if teammates:
            # Add teammates as delegation tools (they become delegate_to_* tools)
            tool_data = tool_data or []
            for tm in teammates:
                tool_data.append({
                    'node_id': tm['node_id'],
                    'node_type': tm['node_type'],
                    'label': tm['label'],
                    'parameters': tm.get('parameters', {}),
                })
            logger.info(f"[Teams] Added {len(teammates)} teammates as delegation tools")

    # Standard execution (no team mode)
    return await ai_service.execute_chat_agent(
        node_id,
        parameters,
        memory_data=memory_data,
        skill_data=skill_data if skill_data else None,
        tool_data=tool_data if tool_data else None,
        broadcaster=broadcaster,
        workflow_id=workflow_id,
        context=context,
        database=database
    )


async def handle_ai_chat_model(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    ai_service: "AIService"
) -> Dict[str, Any]:
    """Handle AI chat model node execution.

    Args:
        node_id: The node ID
        node_type: The node type (openaiChatModel, anthropicChatModel, etc.)
        parameters: Resolved parameters
        context: Execution context
        ai_service: The AI service instance

    Returns:
        Execution result dict
    """
    return await ai_service.execute_chat(node_id, node_type, parameters)


async def handle_simple_memory(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle simple memory node execution.

    Args:
        node_id: The node ID
        node_type: The node type (simpleMemory)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict with session info and messages
    """
    from services.memory_store import get_messages, clear_session

    session_id = parameters.get('sessionId', 'default')
    memory_type = parameters.get('memoryType', 'buffer')
    window_size = int(parameters.get('windowSize', 10)) if memory_type == 'window' else None
    clear_on_run = parameters.get('clearOnRun', False)

    if clear_on_run:
        cleared = clear_session(session_id)
        logger.info(f"[Memory] Cleared {cleared} messages from session '{session_id}'")

    messages = get_messages(session_id, window_size)

    return {
        "success": True,
        "result": {
            "session_id": session_id,
            "messages": messages,
            "message_count": len(messages),
            "memory_type": memory_type,
            "window_size": window_size
        }
    }
