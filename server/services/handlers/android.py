"""Android node handlers - Android Services."""

import json
from typing import Dict, Any, TYPE_CHECKING
from core.logging import get_logger
from constants import ANDROID_SERVICE_NODE_TYPES

if TYPE_CHECKING:
    from services.android_service import AndroidService

logger = get_logger(__name__)


async def handle_android_service(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    android_service: "AndroidService"
) -> Dict[str, Any]:
    """Handle Android service node execution.

    Executes Android service actions like battery status, network info, etc.

    Args:
        node_id: The node ID
        node_type: The node type (batteryMonitor, networkMonitor, etc.)
        parameters: Resolved parameters
        context: Execution context
        android_service: The Android service instance

    Returns:
        Execution result dict
    """
    logger.debug(f"[ANDROID DEBUG] Matched! node_type={node_type}")

    service_id = parameters.get('service_id', 'battery')
    action = parameters.get('action', 'status')
    service_params = parameters.get('parameters', {})
    android_host = parameters.get('android_host', 'localhost')
    android_port = parameters.get('android_port', 8888)

    # Parse parameters if it's a JSON string
    if isinstance(service_params, str):
        try:
            service_params = json.loads(service_params)
        except json.JSONDecodeError:
            service_params = {}

    # Extract additional parameters that are at root level (from additionalProperties in node definitions)
    # These include: package_name (appLauncher), and any future custom parameters
    additional_param_keys = ['package_name']
    for key in additional_param_keys:
        if key in parameters and parameters[key]:
            service_params[key] = parameters[key]

    logger.debug(f"[ANDROID DEBUG] Extracted params: service_id={service_id}, action={action}, host={android_host}, port={android_port}, service_params={service_params}")
    logger.debug(f"[ANDROID DEBUG] About to call android_service.execute_service")

    result = await android_service.execute_service(
        node_id=node_id,
        service_id=service_id,
        action=action,
        parameters=service_params,
        android_host=android_host,
        android_port=android_port
    )
    logger.debug(f"[ANDROID DEBUG] Got result from android_service")
    return result
