"""Polyglot node handlers - execute nodes via polyglot-server plugin registry.

This module provides handlers for routing node execution to polyglot-server.
It is designed to be optionally integrated without modifying the existing
workflow execution flow.

Usage:
    # Optional integration - only if polyglot-server is running
    from services.handlers.polyglot import handle_polyglot_node, POLYGLOT_NODE_TYPES
"""

import time
from datetime import datetime
from typing import Dict, Any

from core.logging import get_logger

logger = get_logger(__name__)


async def handle_polyglot_node(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    polyglot_client,  # Injected via functools.partial
) -> Dict[str, Any]:
    """Execute a workflow node via polyglot-server plugin registry.

    Args:
        node_id: The workflow node ID
        node_type: The node type (e.g., 'discordNode', 'telegramNode')
        parameters: Resolved node parameters
        context: Execution context
        polyglot_client: PolyglotClient instance

    Returns:
        Execution result dict
    """
    start_time = time.time()

    # Extract plugin name from node_type
    plugin_name = node_type.replace("Node", "").lower()
    action = parameters.get("action", "default")
    params = {k: v for k, v in parameters.items() if k != "action"}

    logger.info(
        "[Polyglot] Executing plugin",
        node_id=node_id,
        plugin=plugin_name,
        action=action,
    )

    try:
        result = await polyglot_client.execute(plugin_name, action, params)
        execution_time = time.time() - start_time

        if result.get("success", False):
            return {
                "success": True,
                "node_id": node_id,
                "node_type": node_type,
                "result": result.get("result", {}),
                "timestamp": datetime.now().isoformat(),
                "execution_time": execution_time,
            }
        else:
            return {
                "success": False,
                "node_id": node_id,
                "node_type": node_type,
                "error": result.get("error", "Unknown error"),
                "timestamp": datetime.now().isoformat(),
                "execution_time": execution_time,
            }

    except Exception as e:
        return {
            "success": False,
            "node_id": node_id,
            "node_type": node_type,
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
            "execution_time": time.time() - start_time,
        }


# Node types that can be routed to polyglot-server (for future use)
POLYGLOT_NODE_TYPES = frozenset([
    "discordNode",
    "telegramNode",
    "slackNode",
    "signalNode",
    "notionNode",
    "todoistNode",
    "gmailNode",
    "outlookNode",
    "twitterNode",
    "instagramNode",
    "linkedinNode",
    "dalleNode",
    "stableDiffusionNode",
    "githubNode",
    "gitlabNode",
])
