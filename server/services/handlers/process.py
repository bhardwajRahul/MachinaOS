"""Process manager handler -- dual-purpose (workflow node + AI tool).

Follows the same pattern as handlers/todo.py.
"""

import os
import time
from typing import Any, Dict

from core.logging import get_logger
from services.process_service import get_process_service

logger = get_logger(__name__)


async def handle_process_manager(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Workflow node entry point."""
    t0 = time.time()
    workflow_id = context.get("workflow_id", "default")
    workspace_dir = context.get("workspace_dir", "")

    # Each agent node gets its own subfolder in the workspace
    agent_dir = os.path.join(workspace_dir, node_id) if workspace_dir else ""

    tool_args = {
        "operation": parameters.get("operation", "list"),
        "name": parameters.get("name", ""),
        "command": parameters.get("command", ""),
        "working_directory": parameters.get("working_directory", "") or agent_dir,
        "text": parameters.get("text", ""),
    }
    config = {"workflow_id": workflow_id, "workspace_dir": agent_dir}

    result = await execute_process_manager(tool_args, config)
    result["node_id"] = node_id
    result["execution_time"] = time.time() - t0
    return result


def _clean_arg(val: str) -> str:
    """LLMs sometimes pass literal 'None' string instead of omitting the field."""
    if not val or val == "None":
        return ""
    return val


async def execute_process_manager(tool_args: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """AI tool entry point. Dispatches by operation."""
    svc = get_process_service()
    op = tool_args.get("operation", "list")
    workflow_id = config.get("workflow_id", "default")
    name = _clean_arg(tool_args.get("name", ""))
    workspace_dir = config.get("workspace_dir", "")

    logger.info("[ProcessManager] op=%s name=%s workspace=%s", op, name, workspace_dir)

    if op == "start":
        return await svc.start(
            name=name,
            command=_clean_arg(tool_args.get("command", "")),
            workflow_id=workflow_id,
            working_directory=_clean_arg(tool_args.get("working_directory", "")) or workspace_dir,
        )
    elif op == "stop":
        return await svc.stop(name, workflow_id)
    elif op == "restart":
        return await svc.restart(name, workflow_id)
    elif op == "send_input":
        return await svc.send_input(name, workflow_id, _clean_arg(tool_args.get("text", "")))
    elif op == "list":
        return {"success": True, "result": {"processes": svc.list_processes(workflow_id)}}
    elif op == "get_output":
        stream = _clean_arg(tool_args.get("stream", "")) or "stdout"
        tail = int(tool_args.get("tail", 50) or 50)
        offset = int(tool_args.get("offset", 0))
        return {"success": True, "result": svc.get_output(name, workflow_id, stream, tail, offset)}
    else:
        return {"success": False, "error": f"Unknown operation: {op}"}
