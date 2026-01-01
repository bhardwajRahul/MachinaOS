"""Android node handlers - Device Setup and Android Services."""

import json
import time
from datetime import datetime
from typing import Dict, Any, TYPE_CHECKING
from core.logging import get_logger
from constants import ANDROID_SERVICE_NODE_TYPES

if TYPE_CHECKING:
    from services.android_service import AndroidService
    from core.config import Settings

logger = get_logger(__name__)


async def handle_android_device_setup(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    settings: "Settings"
) -> Dict[str, Any]:
    """Handle Android device setup node execution.

    Supports two connection types:
    - local: ADB connection with port forwarding
    - remote: WebSocket connection to remote proxy

    Args:
        node_id: The node ID
        node_type: The node type (androidDeviceSetup)
        parameters: Resolved parameters
        context: Execution context with start_time
        settings: Application settings

    Returns:
        Execution result dict with connection info
    """
    start_time = context.get('start_time', time.time())
    connection_type = parameters.get('connection_type', 'local')
    device_id = parameters.get('device_id', '')
    websocket_url = parameters.get('websocket_url', settings.websocket_url)
    port = parameters.get('port', 8888)
    auto_forward = parameters.get('auto_forward', True)

    logger.info("[Android Device Setup] Executing", node_id=node_id, connection_type=connection_type,
               device_id=device_id, websocket_url=websocket_url, port=port, auto_forward=auto_forward)

    if connection_type == 'local' and auto_forward and device_id:
        # Local ADB connection with port forwarding
        import subprocess
        try:
            cmd = ["adb", "-s", device_id, "forward", f"tcp:{port}", f"tcp:{port}"]
            subprocess_result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5)

            if subprocess_result.returncode == 0:
                connection_info = {
                    "connection_type": "local",
                    "device_id": device_id,
                    "port": port,
                    "port_forwarding": "active",
                    "local_endpoint": f"http://localhost:{port}",
                    "message": f"Port forwarding setup: localhost:{port} -> device:{port}",
                    "timestamp": datetime.now().isoformat()
                }
                return {
                    "success": True,
                    "node_id": node_id,
                    "node_type": node_type,
                    "result": connection_info,
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                error_msg = subprocess_result.stderr.strip() or subprocess_result.stdout.strip()
                return {
                    "success": False,
                    "node_id": node_id,
                    "node_type": node_type,
                    "error": f"Port forwarding failed: {error_msg}",
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            return {
                "success": False,
                "node_id": node_id,
                "node_type": node_type,
                "error": f"Port forwarding error: {str(e)}",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

    elif connection_type == 'remote' and websocket_url:
        # Remote WebSocket connection via Android Services Relay
        try:
            from services.android import get_relay_client

            api_key = settings.websocket_api_key
            if not api_key:
                raise ValueError("WEBSOCKET_API_KEY not configured in environment")

            logger.info("[Android Device Setup] Connecting to Relay",
                       url=websocket_url, api_key=api_key[:8] + "...")

            relay_client = await get_relay_client(websocket_url, api_key)

            if relay_client and relay_client.is_connected():
                # Wait for Android device to pair via QR code
                if not relay_client.is_paired():
                    logger.info("[Android Device Setup] Waiting for Android device to pair...")
                    paired = await relay_client.wait_for_pairing(timeout=5.0)
                    if not paired:
                        # Return QR data for pairing
                        connection_info = {
                            "connection_type": "remote",
                            "websocket_url": websocket_url,
                            "port": port,
                            "status": "waiting_for_pairing",
                            "qr_data": relay_client.qr_data,
                            "session_token": relay_client.session_token,
                            "message": "Scan QR code with Android app to pair",
                            "timestamp": datetime.now().isoformat()
                        }
                        return {
                            "success": True,
                            "node_id": node_id,
                            "node_type": node_type,
                            "result": connection_info,
                            "execution_time": time.time() - start_time,
                            "timestamp": datetime.now().isoformat()
                        }

                # Device is paired
                device_id = relay_client.paired_device_id
                device_name = relay_client.paired_device_name

                connection_info = {
                    "connection_type": "remote",
                    "websocket_url": websocket_url,
                    "port": port,
                    "status": "paired",
                    "paired": True,
                    "device_id": device_id,
                    "device_name": device_name,
                    "session_token": relay_client.session_token,
                    "message": f"Paired with Android device: {device_name or device_id}",
                    "timestamp": datetime.now().isoformat()
                }

                logger.info("[Android Device Setup] Relay connected and paired",
                           device_id=device_id, device_name=device_name)

                return {
                    "success": True,
                    "node_id": node_id,
                    "node_type": node_type,
                    "result": connection_info,
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                logger.error("[Android Device Setup] Relay connection failed")
                return {
                    "success": False,
                    "node_id": node_id,
                    "node_type": node_type,
                    "error": "Failed to connect to relay server",
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            logger.error("[Android Device Setup] Relay error", error=str(e))
            return {
                "success": False,
                "node_id": node_id,
                "node_type": node_type,
                "error": f"Relay connection error: {str(e)}",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }
    else:
        # Configuration saved without active setup
        connection_info = {
            "connection_type": connection_type,
            "device_id": device_id if connection_type == 'local' else None,
            "websocket_url": websocket_url if connection_type == 'remote' else None,
            "port": port,
            "port_forwarding": "not_setup",
            "message": "Device configuration saved (auto_forward disabled or missing device info)",
            "timestamp": datetime.now().isoformat()
        }

        return {
            "success": True,
            "node_id": node_id,
            "node_type": node_type,
            "result": connection_info,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


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
