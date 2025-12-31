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
        node_type: The node type (createMap)
        parameters: Resolved parameters
        context: Execution context
        maps_service: The maps service instance

    Returns:
        Execution result dict
    """
    logger.info("[Maps Execution] Executing createMap", node_id=node_id)
    result = await maps_service.create_map(node_id, parameters)
    logger.info("[Maps Execution] createMap result", success=result.get('success'),
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
        node_type: The node type (addLocations)
        parameters: Resolved parameters
        context: Execution context
        maps_service: The maps service instance

    Returns:
        Execution result dict
    """
    logger.info("[Maps Execution] Executing addLocations", node_id=node_id)
    result = await maps_service.geocode_location(node_id, parameters)
    logger.info("[Maps Execution] addLocations result", success=result.get('success'),
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
        node_type: The node type (showNearbyPlaces)
        parameters: Resolved parameters
        context: Execution context
        maps_service: The maps service instance

    Returns:
        Execution result dict
    """
    logger.info("[Maps Execution] Executing showNearbyPlaces", node_id=node_id)
    result = await maps_service.find_nearby_places(node_id, parameters)
    logger.info("[Maps Execution] showNearbyPlaces result", success=result.get('success'),
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
