"""AI node handlers - AI Agent, AI Chat Model, Simple Memory."""

from typing import Dict, Any, List, TYPE_CHECKING
from core.logging import get_logger

if TYPE_CHECKING:
    from services.ai import AIService
    from core.database import Database

logger = get_logger(__name__)


async def handle_ai_agent(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    ai_service: "AIService",
    database: "Database"
) -> Dict[str, Any]:
    """Handle AI agent node execution with memory and tool support.

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
    nodes = context.get('nodes')
    edges = context.get('edges')
    execution_id = context.get('execution_id', 'unknown')
    workflow_id = context.get('workflow_id')  # Extract for status broadcasts
    memory_data = None
    tool_data: List[Dict[str, Any]] = []  # Collect connected tool nodes

    if edges and nodes:
        for edge in edges:
            if edge.get('target') != node_id:
                continue

            target_handle = edge.get('targetHandle')
            source_node_id = edge.get('source')
            source_node = next((n for n in nodes if n.get('id') == source_node_id), None)

            if not source_node:
                continue

            # Memory detection (existing)
            if target_handle == 'input-memory':
                if source_node.get('type') == 'simpleMemory':
                    memory_params = await database.get_node_parameters(source_node_id) or {}
                    memory_session_id = memory_params.get('sessionId', 'default')
                    memory_type = memory_params.get('memoryType', 'buffer')
                    window_size = int(memory_params.get('windowSize', 10)) if memory_type == 'window' else None
                    memory_data = {
                        'session_id': memory_session_id,
                        'memory_type': memory_type,
                        'window_size': window_size
                    }
                    logger.info("AI Agent connected memory node", node_id=node_id, execution_id=execution_id,
                               memory_session=memory_session_id, memory_type=memory_type)

            # Tool detection (new) - any node connected to input-tools becomes a tool
            elif target_handle == 'input-tools':
                tool_type = source_node.get('type')
                tool_params = await database.get_node_parameters(source_node_id) or {}
                tool_data.append({
                    'node_id': source_node_id,
                    'node_type': tool_type,
                    'parameters': tool_params,
                    'label': source_node.get('data', {}).get('label', tool_type)
                })
                logger.info("AI Agent connected tool node", node_id=node_id, execution_id=execution_id,
                           tool_type=tool_type, tool_node_id=source_node_id)

    # Get broadcaster for real-time status updates
    from services.status_broadcaster import get_status_broadcaster
    broadcaster = get_status_broadcaster()

    return await ai_service.execute_agent(
        node_id,
        parameters,
        memory_data=memory_data,
        tool_data=tool_data if tool_data else None,
        broadcaster=broadcaster,
        workflow_id=workflow_id
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
