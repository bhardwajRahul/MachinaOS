"""Deep Agent adapters -- protocol translation between MachinaOs and deepagents.

Follows the same pattern as rlm/adapters.py:
- ToolAdapter: wraps schema-only tools with real executors
- SubAgentAdapter: converts teammates to deepagents SubAgent dicts
- ResponseExtractor: extracts response + thinking from multi-format messages
"""

from typing import Any, Dict, List, Optional

from langchain_core.tools import StructuredTool
from core.logging import get_logger

logger = get_logger(__name__)


class ToolAdapter:
    """Wraps schema-only StructuredTools with real async executors.

    _build_tool_from_node() returns tools with placeholder_func (schema only).
    deepagents' ToolNode calls tool.ainvoke() directly, so each tool needs
    a real coroutine calling execute_tool() from handlers/tools.py.
    """

    @staticmethod
    def build_tools(
        tool_data: List[Dict[str, Any]],
        build_tool_fn,
        workflow_id: str = None,
        broadcaster=None,
        workspace_dir: str = "",
    ) -> List[StructuredTool]:
        """Build executable tools from raw tool_data.

        Args:
            tool_data: Raw tool info dicts from _collect_agent_connections.
            build_tool_fn: AIService._build_tool_from_node (async).
            workflow_id: For scoped status broadcasts.
            broadcaster: For tool node glow effects.
            workspace_dir: Per-workflow workspace path for filesystem tools.

        Returns:
            List of StructuredTools with real async executors.
        """
        # Return coroutine - must be awaited
        return ToolAdapter._build_tools_async(tool_data, build_tool_fn, workflow_id, broadcaster, workspace_dir)

    @staticmethod
    async def _build_tools_async(tool_data, build_tool_fn, workflow_id, broadcaster, workspace_dir=""):
        executable = []
        for tool_info in tool_data:
            try:
                tool, config = await build_tool_fn(tool_info)
                if tool and config:
                    if workspace_dir:
                        config['workspace_dir'] = workspace_dir
                    executable.append(
                        ToolAdapter._wrap(tool, config, workflow_id, broadcaster)
                    )
            except Exception as e:
                logger.warning("[DeepAgent] Failed to build tool from %s: %s",
                               tool_info.get("node_type"), e)
        return executable

    @staticmethod
    def _wrap(tool: StructuredTool, config: Dict, workflow_id: str, broadcaster) -> StructuredTool:
        """Replace placeholder func with a real async executor."""
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
                logger.error("[DeepAgent] Tool %s failed: %s", tool_name, e)
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


class SubAgentAdapter:
    """Converts MachinaOs teammate dicts to deepagents SubAgent format."""

    @staticmethod
    def convert(teammates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                "name": tm.get("label", tm.get("node_type", "agent")),
                "description": f"Delegate tasks to {tm.get('label', tm.get('node_type', 'agent'))}",
                "system_prompt": tm.get("system_prompt", ""),
            }
            for tm in teammates
        ]


class ResponseExtractor:
    """Extracts response text, thinking content, and iteration count from messages."""

    @staticmethod
    def extract(messages: list) -> Dict[str, Any]:
        """Extract response, thinking, and iterations from deepagents result messages.

        Returns:
            Dict with keys: response, thinking, iterations
        """
        response_content = ""
        thinking_content = None
        iterations = 0

        # Count iterations (tool-call messages indicate agent loops)
        for msg in messages:
            if getattr(msg, "type", None) == "ai" and getattr(msg, "tool_calls", None):
                iterations += 1

        # Extract final AI response
        for msg in reversed(messages):
            if getattr(msg, "type", None) == "ai" and hasattr(msg, "content"):
                raw = msg.content

                # Handle list content (Gemini format)
                if isinstance(raw, list):
                    parts = []
                    for block in raw:
                        if isinstance(block, dict) and block.get("type") == "text":
                            parts.append(block.get("text", ""))
                        elif isinstance(block, str):
                            parts.append(block)
                    response_content = "\n".join(parts)
                elif isinstance(raw, str):
                    response_content = raw
                else:
                    response_content = str(raw)

                # Extract thinking
                from services.ai import extract_thinking_from_response
                _, thinking_content = extract_thinking_from_response(msg)
                break

        return {
            "response": response_content,
            "thinking": thinking_content,
            "iterations": max(iterations, 1),
        }
