"""Deep Agent handler -- thin wrapper following handle_rlm_agent pattern.

Collects connections, builds executable tools, delegates to DeepAgentService.
"""

from typing import Any, Dict, TYPE_CHECKING
from langchain_core.tools import StructuredTool
from core.logging import get_logger

if TYPE_CHECKING:
    from services.ai import AIService
    from core.database import Database

logger = get_logger(__name__)


def _make_executable_tool(
    tool: StructuredTool,
    config: Dict[str, Any],
    workflow_id: str = None,
    broadcaster=None,
) -> StructuredTool:
    """Wrap a schema-only tool with a real async executor.

    _build_tool_from_node() returns tools with placeholder_func (schema only).
    deepagents' ToolNode calls tool.ainvoke() directly, so each tool needs
    a real coroutine. This follows the deepagents pattern:
    StructuredTool.from_function(coroutine=async_fn, args_schema=...)
    """
    tool_name = tool.name
    tool_node_id = config.get('node_id')

    async def _execute(**kwargs) -> Any:
        from services.handlers.tools import execute_tool

        if tool_node_id and broadcaster:
            await broadcaster.update_node_status(
                tool_node_id, "executing",
                {"message": f"Executing {tool_name}"},
                workflow_id=workflow_id,
            )

        cfg = {**config, 'workflow_id': workflow_id}
        try:
            result = await execute_tool(tool_name, kwargs, cfg)
            if tool_node_id and broadcaster:
                await broadcaster.update_node_status(
                    tool_node_id, "success",
                    {"message": f"{tool_name} completed"},
                    workflow_id=workflow_id,
                )
            return result
        except Exception as e:
            logger.error("[Deep Agent] Tool %s failed: %s", tool_name, e)
            if tool_node_id and broadcaster:
                await broadcaster.update_node_status(
                    tool_node_id, "error",
                    {"message": str(e)},
                    workflow_id=workflow_id,
                )
            return {"error": str(e)}

    return StructuredTool.from_function(
        name=tool.name,
        description=tool.description,
        coroutine=_execute,
        args_schema=tool.get_input_schema(),
    )


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
    2. _format_task_context()                [REUSE]
    3. Auto-prompt fallback                  [REUSE]
    4. Build executable tools                [_build_tool_from_node + _make_executable_tool]
    5. Collect teammates                     [_collect_teammate_connections]
    6. Delegate to DeepAgentService.execute()
    """
    from .ai import _collect_agent_connections, _collect_teammate_connections, _format_task_context
    from services.status_broadcaster import get_status_broadcaster

    workflow_id = context.get('workflow_id')
    broadcaster = get_status_broadcaster()

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

    # 4. Build executable tools from connected tool nodes
    executable_tools = []
    if tool_data:
        for tool_info in tool_data:
            try:
                tool, config = await ai_service._build_tool_from_node(tool_info)
                if tool and config:
                    executable_tools.append(
                        _make_executable_tool(tool, config, workflow_id, broadcaster)
                    )
            except Exception as e:
                logger.warning("[Deep Agent] Failed to build tool from %s: %s",
                               tool_info.get("node_type"), e)

    # 5. Collect teammates for sub-agent delegation
    teammates = await _collect_teammate_connections(node_id, context, database)

    # 6. Delegate to DeepAgentService
    return await ai_service.deep_agent_service.execute(
        node_id, parameters,
        memory_data=memory_data if memory_data else None,
        skill_data=skill_data if skill_data else None,
        tools=executable_tools if executable_tools else None,
        teammates=teammates if teammates else None,
        broadcaster=broadcaster,
        workflow_id=workflow_id,
        database=database,
    )
