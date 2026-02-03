"""Utility node handlers - Maps, Text, Chat, Cron, Start."""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, TYPE_CHECKING
from core.logging import get_logger

if TYPE_CHECKING:
    from services.maps import MapsService
    from services.text import TextService

logger = get_logger(__name__)


# =============================================================================
# MAPS HANDLERS
# =============================================================================

async def handle_create_map(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    maps_service: "MapsService"
) -> Dict[str, Any]:
    """Handle create map node execution.

    Args:
        node_id: The node ID
        node_type: The node type (gmaps_create)
        parameters: Resolved parameters
        context: Execution context
        maps_service: The maps service instance

    Returns:
        Execution result dict
    """
    logger.info("[Maps Execution] Executing gmaps_create", node_id=node_id)
    result = await maps_service.create_map(node_id, parameters)
    logger.info("[Maps Execution] gmaps_create result", success=result.get('success'),
               has_result='result' in result,
               result_keys=list(result.get('result', {}).keys()) if isinstance(result.get('result'), dict) else 'not_dict')
    return result


async def handle_add_locations(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    maps_service: "MapsService"
) -> Dict[str, Any]:
    """Handle add locations node execution (geocoding).

    Args:
        node_id: The node ID
        node_type: The node type (gmaps_locations)
        parameters: Resolved parameters
        context: Execution context
        maps_service: The maps service instance

    Returns:
        Execution result dict
    """
    logger.info("[Maps Execution] Executing gmaps_locations", node_id=node_id)
    result = await maps_service.geocode_location(node_id, parameters)
    logger.info("[Maps Execution] gmaps_locations result", success=result.get('success'),
               has_result='result' in result,
               result_keys=list(result.get('result', {}).keys()) if isinstance(result.get('result'), dict) else 'not_dict')
    return result


async def handle_nearby_places(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    maps_service: "MapsService"
) -> Dict[str, Any]:
    """Handle show nearby places node execution.

    Args:
        node_id: The node ID
        node_type: The node type (gmaps_nearby_places)
        parameters: Resolved parameters
        context: Execution context
        maps_service: The maps service instance

    Returns:
        Execution result dict
    """
    logger.info("[Maps Execution] Executing gmaps_nearby_places", node_id=node_id)
    result = await maps_service.find_nearby_places(node_id, parameters)
    logger.info("[Maps Execution] gmaps_nearby_places result", success=result.get('success'),
               has_result='result' in result,
               result_keys=list(result.get('result', {}).keys()) if isinstance(result.get('result'), dict) else 'not_dict')
    return result


# =============================================================================
# TEXT HANDLERS
# =============================================================================

async def handle_text_generator(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    text_service: "TextService"
) -> Dict[str, Any]:
    """Handle text generator node execution.

    Args:
        node_id: The node ID
        node_type: The node type (textGenerator)
        parameters: Resolved parameters
        context: Execution context
        text_service: The text service instance

    Returns:
        Execution result dict
    """
    return await text_service.execute_text_generator(node_id, parameters)


async def handle_file_handler(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    text_service: "TextService"
) -> Dict[str, Any]:
    """Handle file handler node execution.

    Args:
        node_id: The node ID
        node_type: The node type (fileHandler)
        parameters: Resolved parameters
        context: Execution context
        text_service: The text service instance

    Returns:
        Execution result dict
    """
    return await text_service.execute_file_handler(node_id, parameters)


# =============================================================================
# CHAT HANDLERS
# =============================================================================

async def handle_chat_send(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle chat send message via JSON-RPC 2.0 WebSocket.

    Args:
        node_id: The node ID
        node_type: The node type (chatSend)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict
    """
    from services.chat_client import send_chat_message
    start_time = time.time()

    try:
        host = parameters.get('host', 'localhost')
        port = int(parameters.get('port', 8080))
        session_id = parameters.get('session_id', 'default')
        api_key = parameters.get('api_key', '')
        content = parameters.get('content', '')

        if not content:
            raise ValueError("Message content is required")

        result = await send_chat_message(
            host=host, port=port, session_id=session_id,
            api_key=api_key, content=content
        )

        if result.get('success'):
            return {
                "success": True,
                "node_id": node_id,
                "node_type": "chatSend",
                "result": result.get('result', {}),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise Exception(result.get('error', 'Send failed'))

    except Exception as e:
        logger.error("Chat send failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "chatSend",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def handle_chat_history(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle chat get history via JSON-RPC 2.0 WebSocket.

    Args:
        node_id: The node ID
        node_type: The node type (chatHistory)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict with messages
    """
    from services.chat_client import get_chat_history
    start_time = time.time()

    try:
        host = parameters.get('host', 'localhost')
        port = int(parameters.get('port', 8080))
        session_id = parameters.get('session_id', 'default')
        api_key = parameters.get('api_key', '')
        limit = int(parameters.get('limit', 50))

        result = await get_chat_history(
            host=host, port=port, session_id=session_id,
            api_key=api_key, limit=limit
        )

        if result.get('success'):
            return {
                "success": True,
                "node_id": node_id,
                "node_type": "chatHistory",
                "result": {"messages": result.get('messages', [])},
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise Exception(result.get('error', 'History fetch failed'))

    except Exception as e:
        logger.error("Chat history failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "chatHistory",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# WORKFLOW CONTROL HANDLERS
# =============================================================================

async def handle_start(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle start node execution.

    Args:
        node_id: The node ID
        node_type: The node type (start)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict with initial data
    """
    initial_data_str = parameters.get('initialData', '{}')
    try:
        initial_data = json.loads(initial_data_str)
    except:
        initial_data = {}

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "start",
        "result": initial_data
    }


async def handle_cron_scheduler(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle cron scheduler node execution.

    Waits for the configured interval duration before triggering.
    Used for recurring scheduled tasks.

    Args:
        node_id: The node ID
        node_type: The node type (cronScheduler)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict with schedule info
    """
    from services.status_broadcaster import get_status_broadcaster
    start_time = time.time()

    try:
        frequency = parameters.get('frequency', 'minutes')
        timezone = parameters.get('timezone', 'UTC')

        # Build human-readable schedule description
        schedule_desc = _get_schedule_description(parameters)

        logger.info("[CronScheduler] Executing",
                   node_id=node_id,
                   frequency=frequency,
                   schedule=schedule_desc)

        # Calculate wait time in seconds based on frequency
        wait_seconds = _calculate_wait_seconds(parameters)

        now = datetime.now()
        trigger_time = now + timedelta(seconds=wait_seconds)

        # Get workflow_id from context for per-workflow status scoping (n8n pattern)
        workflow_id = context.get('workflow_id')

        # Broadcast waiting status to frontend
        broadcaster = get_status_broadcaster()
        await broadcaster.update_node_status(node_id, "waiting", {
            "message": f"Waiting {schedule_desc}...",
            "trigger_time": trigger_time.isoformat(),
            "wait_seconds": wait_seconds
        }, workflow_id=workflow_id)

        logger.info(f"[CronScheduler] Waiting {wait_seconds} seconds until trigger",
                   node_id=node_id, trigger_time=trigger_time.isoformat())

        # Wait for the duration
        await asyncio.sleep(wait_seconds)

        # Build result data after wait completes
        triggered_at = datetime.now()
        result_data = {
            "timestamp": triggered_at.isoformat(),
            "iteration": 1,
            "frequency": frequency,
            "timezone": timezone,
            "schedule": schedule_desc,
            "scheduled_time": trigger_time.isoformat(),
            "triggered_at": triggered_at.isoformat(),
            "waited_seconds": wait_seconds
        }

        if frequency == 'once':
            result_data["message"] = f"Triggered after waiting {_format_wait_time(wait_seconds)}"
        else:
            result_data["next_run"] = schedule_desc
            result_data["message"] = f"Triggered after {_format_wait_time(wait_seconds)}, will repeat: {schedule_desc}"

        return {
            "success": True,
            "node_id": node_id,
            "node_type": "cronScheduler",
            "result": result_data,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except asyncio.CancelledError:
        logger.info("[CronScheduler] Cancelled while waiting", node_id=node_id)
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "cronScheduler",
            "error": "Scheduler cancelled",
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error("CronScheduler execution failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "cronScheduler",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# CRON HELPER FUNCTIONS
# =============================================================================

def _calculate_wait_seconds(parameters: Dict[str, Any]) -> int:
    """Calculate wait time in seconds based on frequency and interval."""
    frequency = parameters.get('frequency', 'minutes')

    # Calculate wait based on frequency type
    match frequency:
        case 'seconds':
            return int(parameters.get('interval', 30))
        case 'minutes':
            return int(parameters.get('intervalMinutes', 5)) * 60
        case 'hours':
            return int(parameters.get('intervalHours', 1)) * 3600
        case 'days':
            return 24 * 3600  # Wait 24 hours
        case 'weeks':
            return 7 * 24 * 3600  # Wait 7 days
        case 'months':
            return 30 * 24 * 3600  # Wait ~30 days
        case 'once':
            return 0  # Trigger immediately
        case _:
            return 300  # Default: 5 minutes


def _format_wait_time(seconds: int) -> str:
    """Format seconds into human-readable time string."""
    if seconds < 60:
        return f"{seconds} seconds"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''}"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''}"
    else:
        days = seconds // 86400
        return f"{days} day{'s' if days != 1 else ''}"


def _get_schedule_description(parameters: Dict[str, Any]) -> str:
    """Get human-readable schedule description from parameters."""
    frequency = parameters.get('frequency', 'minutes')

    match frequency:
        case 'seconds':
            interval = parameters.get('interval', 30)
            return f"Every {interval} seconds"
        case 'minutes':
            interval = parameters.get('intervalMinutes', 5)
            return f"Every {interval} minutes"
        case 'hours':
            interval = parameters.get('intervalHours', 1)
            return f"Every {interval} hours"
        case 'days':
            time_str = parameters.get('dailyTime', '09:00')
            return f"Daily at {time_str}"
        case 'weeks':
            weekday = parameters.get('weekday', '1')
            time_str = parameters.get('weeklyTime', '09:00')
            days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            day_name = days[int(weekday)] if weekday.isdigit() else weekday
            return f"Weekly on {day_name} at {time_str}"
        case 'months':
            day = parameters.get('monthDay', '1')
            time_str = parameters.get('monthlyTime', '09:00')
            return f"Monthly on day {day} at {time_str}"
        case 'once':
            return "Once (no repeat)"
        case _:
            return "Unknown schedule"


# =============================================================================
# TIMER HANDLER
# =============================================================================

async def handle_timer(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle timer node execution - waits for specified duration.

    Args:
        node_id: The node ID
        node_type: The node type (timer)
        parameters: Resolved parameters with duration and unit
        context: Execution context

    Returns:
        Execution result dict with timing info
    """
    from services.status_broadcaster import get_status_broadcaster
    start_time = time.time()

    try:
        duration = int(parameters.get('duration', 5))
        unit = parameters.get('unit', 'seconds')

        # Convert duration to seconds
        match unit:
            case 'seconds':
                wait_seconds = duration
            case 'minutes':
                wait_seconds = duration * 60
            case 'hours':
                wait_seconds = duration * 3600
            case _:
                wait_seconds = duration

        now = datetime.now()
        complete_time = now + timedelta(seconds=wait_seconds)

        # Get workflow_id from context for per-workflow status scoping (n8n pattern)
        workflow_id = context.get('workflow_id')
        logger.info("[Timer] Context workflow_id", node_id=node_id, workflow_id=workflow_id, context_keys=list(context.keys()))

        # Broadcast waiting status
        broadcaster = get_status_broadcaster()
        await broadcaster.update_node_status(node_id, "waiting", {
            "message": f"Waiting {duration} {unit}...",
            "complete_time": complete_time.isoformat(),
            "wait_seconds": wait_seconds
        }, workflow_id=workflow_id)

        logger.info("[Timer] Starting wait",
                   node_id=node_id,
                   duration=duration,
                   unit=unit,
                   wait_seconds=wait_seconds)

        # Wait for the duration
        await asyncio.sleep(wait_seconds)

        elapsed_ms = int((time.time() - start_time) * 1000)

        result_data = {
            "timestamp": datetime.now().isoformat(),
            "elapsed_ms": elapsed_ms,
            "duration": duration,
            "unit": unit,
            "message": f"Timer completed after {duration} {unit}"
        }

        logger.info("[Timer] Completed",
                   node_id=node_id,
                   elapsed_ms=elapsed_ms)

        return {
            "success": True,
            "node_id": node_id,
            "node_type": "timer",
            "result": result_data,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except asyncio.CancelledError:
        logger.info("[Timer] Cancelled", node_id=node_id)
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "timer",
            "error": "Timer cancelled",
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error("[Timer] Failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "timer",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# CONSOLE HANDLER
# =============================================================================

async def handle_console(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    connected_outputs: Dict[str, Any] = None,
    source_nodes: list = None
) -> Dict[str, Any]:
    """Handle console node execution - logs input data for debugging.

    The console node:
    1. Receives input data from connected upstream nodes (via _get_connected_outputs_with_info)
    2. Logs the data to the console panel based on log mode
    3. Passes the input through unchanged to downstream nodes

    Args:
        node_id: The node ID
        node_type: The node type (console)
        parameters: Resolved parameters including label, logMode, format
        context: Execution context
        connected_outputs: Outputs from connected upstream nodes (keyed by node type)
        source_nodes: List of source node info dicts with id, type, label

    Returns:
        Execution result dict with logged data and passthrough output
    """
    from services.status_broadcaster import get_status_broadcaster
    start_time = time.time()

    try:
        label = parameters.get('label', '')
        log_mode = parameters.get('logMode', 'all')
        format_type = parameters.get('format', 'json')
        field_path = parameters.get('fieldPath', '')
        expression = parameters.get('expression', '')

        # Get input data from connected outputs (passed from _get_connected_outputs_with_info)
        connected_outputs = connected_outputs or {}
        source_nodes = source_nodes or []

        logger.debug(f"[Console] connected_outputs keys: {list(connected_outputs.keys())}, count: {len(connected_outputs)}")

        # Merge all connected outputs into a single dict
        input_data = {}
        for node_type, output in connected_outputs.items():
            logger.debug(f"[Console] Processing output from {node_type}: type={type(output).__name__}")
            if isinstance(output, dict):
                input_data.update(output)
            else:
                input_data['value'] = output

        logger.debug(f"[Console] input_data keys: {list(input_data.keys()) if input_data else 'empty'}")

        # Get first source node info for display
        source_info = source_nodes[0] if source_nodes else None

        # Determine what to log based on mode
        logger.debug(f"[Console] log_mode={log_mode}, field_path={field_path[:50] if field_path else 'none'}...")
        log_value = None
        match log_mode:
            case 'all':
                log_value = input_data
            case 'field':
                if field_path:
                    # Check if fieldPath was a template that got resolved (no longer contains {{}})
                    # If it was resolved, use the resolved value directly
                    if '{{' not in field_path and field_path not in input_data:
                        # fieldPath was likely a template like {{aiagent.response}} that got resolved
                        # Use the resolved value directly instead of navigating
                        log_value = field_path
                        logger.debug(f"[Console] Using resolved fieldPath value directly")
                    else:
                        # fieldPath is a literal path like "response" or "data.items[0]"
                        log_value = _navigate_field_path(input_data, field_path)
                else:
                    log_value = input_data
            case 'expression':
                # Expression is already resolved by parameter resolver
                log_value = expression if expression else input_data
            case _:
                log_value = input_data

        # Format the output
        formatted_output = _format_console_output(log_value, format_type)

        # Get workflow_id for scoped broadcasting
        workflow_id = context.get('workflow_id')

        # Broadcast console log to frontend
        broadcaster = get_status_broadcaster()
        await broadcaster.broadcast_console_log({
            "node_id": node_id,
            "label": label or f"Console ({node_id[:8]})",
            "timestamp": datetime.now().isoformat(),
            "data": log_value,
            "formatted": formatted_output,
            "format": format_type,
            "workflow_id": workflow_id,
            "source_node_id": source_info.get('id') if source_info else None,
            "source_node_type": source_info.get('type') if source_info else None,
            "source_node_label": source_info.get('label') if source_info else None
        })

        logger.info("[Console] Logged",
                   node_id=node_id,
                   label=label,
                   format=format_type,
                   data_type=type(log_value).__name__)

        # Return success with the logged data AND pass input through as output
        return {
            "success": True,
            "node_id": node_id,
            "node_type": "console",
            "result": {
                "label": label or f"Console ({node_id[:8]})",
                "logged_at": datetime.now().isoformat(),
                "format": format_type,
                "data": log_value,
                "formatted": formatted_output,
                # Pass through original input for downstream nodes
                **input_data
            },
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error("[Console] Failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "console",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


def _navigate_field_path(data: Any, path: str) -> Any:
    """Navigate through nested dict/list using dot notation path.

    Supports:
    - Dict keys: 'field' -> data['field']
    - Array indexing: 'items[0]' -> data['items'][0]
    - Nested paths: 'data.items[0].name' -> data['data']['items'][0]['name']
    """
    import re

    if not path:
        return data

    current = data
    parts = path.split('.')

    for part in parts:
        if current is None:
            return None

        # Check for array index notation: field[index]
        bracket_match = re.match(r'^(\w+)\[(\d+)\]$', part)
        if bracket_match:
            field_name = bracket_match.group(1)
            index = int(bracket_match.group(2))

            # Navigate to the field first
            if isinstance(current, dict) and field_name in current:
                current = current[field_name]
            else:
                return None

            # Then access the array index
            if isinstance(current, list) and 0 <= index < len(current):
                current = current[index]
            else:
                return None
        else:
            # Standard dict key navigation
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None

    return current


def _format_console_output(data: Any, format_type: str) -> str:
    """Format data for console display based on format type."""
    match format_type:
        case 'json':
            try:
                return json.dumps(data, indent=2, default=str, ensure_ascii=False)
            except Exception:
                return str(data)
        case 'json_compact':
            try:
                return json.dumps(data, default=str, ensure_ascii=False)
            except Exception:
                return str(data)
        case 'text':
            return str(data)
        case 'table':
            # Format as table if data is list of dicts
            if isinstance(data, list) and data and isinstance(data[0], dict):
                headers = list(data[0].keys())
                rows = [[str(row.get(h, '')) for h in headers] for row in data]

                # Calculate column widths
                widths = [max(len(h), max((len(r[i]) for r in rows), default=0))
                         for i, h in enumerate(headers)]

                # Build table string
                header_line = ' | '.join(h.ljust(widths[i]) for i, h in enumerate(headers))
                separator = '-+-'.join('-' * w for w in widths)
                data_lines = [' | '.join(r[i].ljust(widths[i]) for i in range(len(headers)))
                             for r in rows]

                return '\n'.join([header_line, separator] + data_lines)
            else:
                # Fall back to JSON for non-tabular data
                return json.dumps(data, indent=2, default=str, ensure_ascii=False)
        case _:
            return str(data)
