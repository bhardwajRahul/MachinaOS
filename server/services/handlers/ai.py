"""AI node handlers - AI Agent, Zeenie, AI Chat Model, Simple Memory."""

from typing import Dict, Any, List, Optional, Tuple, TYPE_CHECKING
from core.logging import get_logger
from constants import ANDROID_SERVICE_NODE_TYPES

if TYPE_CHECKING:
    from services.ai import AIService
    from core.database import Database

logger = get_logger(__name__)


async def _collect_agent_connections(
    node_id: str,
    context: Dict[str, Any],
    database: "Database",
    log_prefix: str = "[Agent]"
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Shared logic for collecting memory, skill, tool, and input data from connected nodes.

    Scans edges targeting the given node and collects:
    - Memory data from input-memory handle (simpleMemory nodes)
    - Skill data from input-skill handle (skill nodes)
    - Tool data from input-tools handle (tool nodes, including androidTool Sub-Node pattern)
    - Input data from input-main or input-chat handle (for auto-prompting fallback)

    Args:
        node_id: The agent node ID to collect connections for
        context: Execution context with nodes, edges, outputs
        database: The database instance for fetching node parameters
        log_prefix: Prefix for log messages (e.g., "[AI Agent]" or "[Chat Agent]")

    Returns:
        Tuple of (memory_data, skill_data, tool_data, input_data)
    """
    nodes = context.get('nodes')
    edges = context.get('edges')
    workflow_id = context.get('workflow_id')

    memory_data: Optional[Dict[str, Any]] = None
    skill_data: List[Dict[str, Any]] = []
    tool_data: List[Dict[str, Any]] = []
    input_data: Optional[Dict[str, Any]] = None

    logger.info(f"{log_prefix} Processing node {node_id}, edges={len(edges) if edges else 0}, nodes={len(nodes) if nodes else 0}, workflow_id={workflow_id}")

    if not edges or not nodes:
        return memory_data, skill_data, tool_data, input_data

    # Log incoming edges for debugging
    incoming_edges = [e for e in edges if e.get('target') == node_id]
    logger.info(f"{log_prefix} Incoming edges to {node_id}: {len(incoming_edges)}")
    for e in incoming_edges:
        logger.debug(f"{log_prefix} Edge: source={e.get('source')}, targetHandle={e.get('targetHandle')}")

    # Check for tool edges specifically
    tool_incoming = [e for e in incoming_edges if e.get('targetHandle') == 'input-tools']
    logger.info(f"{log_prefix} Tool edges (input-tools handle): {len(tool_incoming)}")

    for edge in edges:
        if edge.get('target') != node_id:
            continue

        target_handle = edge.get('targetHandle')
        source_node_id = edge.get('source')
        source_node = next((n for n in nodes if n.get('id') == source_node_id), None)

        if not source_node:
            continue

        # Memory detection - load markdown content for editing
        if target_handle == 'input-memory':
            if source_node.get('type') == 'simpleMemory':
                memory_params = await database.get_node_parameters(source_node_id) or {}
                memory_session_id = memory_params.get('sessionId', 'default')
                window_size = int(memory_params.get('windowSize', 10))
                memory_content = memory_params.get('memoryContent', '# Conversation History\n\n*No messages yet.*\n')
                long_term_enabled = memory_params.get('longTermEnabled', False)
                retrieval_count = int(memory_params.get('retrievalCount', 3))

                memory_data = {
                    'node_id': source_node_id,
                    'session_id': memory_session_id,
                    'window_size': window_size,
                    'memory_content': memory_content,
                    'long_term_enabled': long_term_enabled,
                    'retrieval_count': retrieval_count
                }
                logger.debug(f"{log_prefix} Connected memory node: session={memory_session_id}, content_length={len(memory_content)}")

        # Skill detection - nodes connected to input-skill handle
        elif target_handle == 'input-skill':
            skill_type = source_node.get('type')
            skill_params = await database.get_node_parameters(source_node_id) or {}

            # Special handling for masterSkill - expand skillsConfig into individual skills
            if skill_type == 'masterSkill':
                from services.skill_loader import get_skill_loader

                skills_config = skill_params.get('skillsConfig', {})
                logger.debug(f"{log_prefix} Master Skill found with {len(skills_config)} configured skills")

                # Get skill loader to load instructions from SKILL.md files
                skill_loader = get_skill_loader()

                for skill_key, skill_cfg in skills_config.items():
                    # Only include enabled skills
                    if not skill_cfg.get('enabled', False):
                        continue

                    # Load instructions: use customized if available, otherwise load from skill folder
                    instructions = ''
                    if skill_cfg.get('isCustomized', False) and skill_cfg.get('instructions'):
                        # Use customized instructions from config
                        instructions = skill_cfg.get('instructions', '')
                        logger.debug(f"{log_prefix} Using customized instructions for {skill_key}")
                    else:
                        # Load from skill folder via skill_loader
                        try:
                            skill = skill_loader.load_skill(skill_key)
                            if skill:
                                instructions = skill.instructions
                                logger.debug(f"{log_prefix} Loaded instructions from skill folder for {skill_key}")
                        except Exception as e:
                            logger.warning(f"{log_prefix} Failed to load skill {skill_key}: {e}")
                            # Fallback to config instructions if available
                            instructions = skill_cfg.get('instructions', '')

                    # Create a skill entry for each enabled skill in the config
                    skill_entry = {
                        'node_id': f"{source_node_id}_{skill_key}",
                        'node_type': 'masterSkill',
                        'skill_name': skill_key,
                        'parameters': {
                            'instructions': instructions,
                            'skillName': skill_key
                        },
                        'label': skill_key
                    }
                    skill_data.append(skill_entry)
                    logger.debug(f"{log_prefix} Master Skill enabled: {skill_key}")
            else:
                # Regular skill node
                skill_entry = {
                    'node_id': source_node_id,
                    'node_type': skill_type,
                    'skill_name': skill_params.get('skillName', skill_type),
                    'parameters': skill_params,
                    'label': source_node.get('data', {}).get('label', skill_type)
                }
                skill_data.append(skill_entry)
                logger.debug(f"{log_prefix} Connected skill: {skill_type}")

        # Tool detection - any node connected to input-tools becomes a tool
        elif target_handle == 'input-tools':
            tool_type = source_node.get('type')
            logger.info(f"{log_prefix} Found tool connected via input-tools: type={tool_type}, node_id={source_node_id}")
            tool_params = await database.get_node_parameters(source_node_id) or {}

            # Build base tool entry
            tool_entry = {
                'node_id': source_node_id,
                'node_type': tool_type,
                'parameters': tool_params,
                'label': source_node.get('data', {}).get('label', tool_type)
            }

            # Special handling for androidTool - discover connected Android services
            # Follows n8n Sub-Node pattern
            if tool_type == 'androidTool':
                connected_services = []

                # Scan edges for Android nodes connected to this toolkit
                for service_edge in edges:
                    # Skip if not targeting this androidTool node
                    if service_edge.get('target') != source_node_id:
                        continue

                    service_target_handle = service_edge.get('targetHandle')
                    # Accept input-main or no handle (ReactFlow may omit handle for single-input nodes)
                    if service_target_handle is not None and service_target_handle != 'input-main':
                        logger.debug(f"{log_prefix} Android Toolkit: Skipping edge with targetHandle: {service_target_handle}")
                        continue

                    android_node_id = service_edge.get('source')
                    android_node = next((n for n in nodes if n.get('id') == android_node_id), None)

                    if android_node and android_node.get('type') in ANDROID_SERVICE_NODE_TYPES:
                        android_params = await database.get_node_parameters(android_node_id) or {}
                        connected_services.append({
                            'node_id': android_node_id,
                            'node_type': android_node.get('type'),
                            'service_id': android_params.get('service_id'),
                            'action': android_params.get('action'),
                            'parameters': android_params,
                            'label': android_node.get('data', {}).get('label', android_node.get('type'))
                        })
                        logger.debug(f"{log_prefix} Android toolkit connected service: {android_params.get('service_id')}")

                tool_entry['connected_services'] = connected_services
                logger.debug(f"{log_prefix} Android toolkit has {len(connected_services)} connected services")

            tool_data.append(tool_entry)
            logger.debug(f"{log_prefix} Connected tool: {tool_type}")

        # Input data detection - nodes connected to input-main or input-chat handle
        # Used for auto-prompting when prompt parameter is empty
        elif target_handle == 'input-main' or target_handle == 'input-chat' or target_handle is None:
            source_output = context.get('outputs', {}).get(source_node_id)
            if source_output:
                input_data = source_output
                logger.debug(f"{log_prefix} Input from {source_node.get('type')}: {list(source_output.keys()) if isinstance(source_output, dict) else type(source_output)}")

    # Log collection results
    logger.info(f"{log_prefix} Collected: {len(skill_data)} skills, {len(tool_data)} tools, memory={'yes' if memory_data else 'no'}, input={'yes' if input_data else 'no'}")
    for sd in skill_data:
        logger.debug(f"{log_prefix} Skill: type={sd.get('node_type')}, label={sd.get('label')}")
    for td in tool_data:
        logger.info(f"{log_prefix} Tool: type={td.get('node_type')}, node_id={td.get('node_id')}")

    return memory_data, skill_data, tool_data, input_data


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

    # Collect connected memory, skill, tool, and input nodes using shared base function
    memory_data, skill_data, tool_data, input_data = await _collect_agent_connections(
        node_id, context, database, log_prefix="[AI Agent]"
    )

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
        context=context  # Pass context for nested agent delegation
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

    # Collect connected memory, skill, tool, and input nodes using shared base function
    memory_data, skill_data, tool_data, input_data = await _collect_agent_connections(
        node_id, context, database, log_prefix="[Chat Agent]"
    )

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

    # Execute Chat Agent with memory, skills and tools
    return await ai_service.execute_chat_agent(
        node_id,
        parameters,
        memory_data=memory_data,
        skill_data=skill_data if skill_data else None,
        tool_data=tool_data if tool_data else None,
        broadcaster=broadcaster,
        workflow_id=workflow_id,
        context=context  # Pass context for nested agent delegation
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
