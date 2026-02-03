"""Tool execution handlers for AI Agent tool calling.

This module contains handlers for executing tools called by the AI Agent.
Each tool type has its own handler function that processes the tool call
and returns results.
"""

import math
import json
import asyncio
import uuid
from typing import Dict, Any, Optional, TYPE_CHECKING

from core.logging import get_logger
from constants import ANDROID_SERVICE_NODE_TYPES

if TYPE_CHECKING:
    from services.ai import AIService
    from core.database import Database

logger = get_logger(__name__)

# Track running delegated tasks for status checking
_delegated_tasks: Dict[str, asyncio.Task] = {}


async def execute_tool(tool_name: str, tool_args: Dict[str, Any],
                       config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a tool by name using the appropriate handler.

    This is the main dispatch function that routes tool calls to specific handlers
    based on the node_type in the config.

    Args:
        tool_name: Name of the tool (for logging)
        tool_args: Arguments provided by the AI model
        config: Tool configuration containing node_type, node_id, parameters

    Returns:
        Tool execution result dict
    """
    node_type = config.get('node_type', '')

    logger.info(f"[Tool] Executing tool '{tool_name}' (node_type: {node_type})")

    # Calculator tool
    if node_type == 'calculatorTool':
        return await _execute_calculator(tool_args)

    # HTTP Request tool (existing httpRequest node as tool)
    if node_type in ('httpRequest', 'httpRequestTool'):
        return await _execute_http_request(tool_args, config.get('parameters', {}))

    # Python executor tool (dual-purpose: workflow node + AI tool)
    if node_type == 'pythonExecutor':
        return await _execute_python_code(tool_args, config.get('parameters', {}))

    # JavaScript executor tool (dual-purpose: workflow node + AI tool)
    if node_type == 'javascriptExecutor':
        return await _execute_javascript_code(tool_args, config.get('parameters', {}))

    # Current time tool
    if node_type == 'currentTimeTool':
        return await _execute_current_time(tool_args, config.get('parameters', {}))

    # Web search tool
    if node_type == 'webSearchTool':
        return await _execute_web_search(tool_args, config.get('parameters', {}))

    # WhatsApp send (existing node used as tool)
    if node_type == 'whatsappSend':
        return await _execute_whatsapp_send(tool_args, config.get('parameters', {}))

    # WhatsApp DB (existing node used as tool) - query contacts, groups, messages
    if node_type == 'whatsappDb':
        return await _execute_whatsapp_db(tool_args, config.get('parameters', {}))

    # Android toolkit - routes to connected service nodes
    if node_type == 'androidTool':
        return await _execute_android_toolkit(tool_args, config)

    # Direct Android service node (connected directly to AI Agent tools handle)
    if node_type in ANDROID_SERVICE_NODE_TYPES:
        return await _execute_android_service(tool_args, config)

    # Google Maps Geocoding (gmaps_locations node as tool)
    if node_type == 'gmaps_locations':
        return await _execute_geocoding(tool_args, config.get('parameters', {}))

    # Google Maps Nearby Places (gmaps_nearby_places node as tool)
    if node_type == 'gmaps_nearby_places':
        return await _execute_nearby_places(tool_args, config.get('parameters', {}))

    # AI Agent delegation (fire-and-forget async delegation)
    if node_type in ('aiAgent', 'chatAgent'):
        return await _execute_delegated_agent(tool_args, config)

    # Generic fallback for unknown node types
    logger.warning(f"[Tool] Unknown tool type: {node_type}, using generic handler")
    return await _execute_generic(tool_args, config)


async def _execute_calculator(args: Dict[str, Any]) -> Dict[str, Any]:
    """Execute calculator operations.

    Supported operations: add, subtract, multiply, divide, power, sqrt, mod, abs

    Args:
        args: Dict with 'operation', 'a', and optionally 'b'

    Returns:
        Dict with operation, inputs, and result
    """
    operation = args.get('operation', '').lower()
    a = float(args.get('a', 0))
    b = float(args.get('b', 0))

    operations = {
        'add': lambda: a + b,
        'subtract': lambda: a - b,
        'multiply': lambda: a * b,
        'divide': lambda: a / b if b != 0 else float('inf'),
        'power': lambda: math.pow(a, b),
        'sqrt': lambda: math.sqrt(abs(a)),  # Use abs to handle negative
        'mod': lambda: a % b if b != 0 else 0,
        'abs': lambda: abs(a),
    }

    if operation not in operations:
        return {
            "error": f"Unknown operation: {operation}",
            "supported_operations": list(operations.keys())
        }

    try:
        result = operations[operation]()
        logger.info(f"[Calculator] {operation}({a}, {b}) = {result}")
        return {
            "operation": operation,
            "a": a,
            "b": b,
            "result": result
        }
    except Exception as e:
        logger.error(f"[Calculator] Error: {e}")
        return {"error": str(e)}


async def _execute_http_request(args: Dict[str, Any],
                                 node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute HTTP request tool.

    Args:
        args: Dict with 'url', 'method', optionally 'body'
        node_params: Node parameters containing base_url, headers, etc.

    Returns:
        Dict with status code, data, and url
    """
    import httpx

    base_url = node_params.get('url', '')
    url = args.get('url', '')
    method = args.get('method', 'GET').upper()
    body = args.get('body')

    # Build full URL
    if base_url and url and not url.startswith('http'):
        full_url = f"{base_url.rstrip('/')}/{url.lstrip('/')}"
    else:
        full_url = url or base_url

    if not full_url:
        return {"error": "No URL provided"}

    # Parse headers from node params
    try:
        default_headers = json.loads(node_params.get('headers', '{}'))
    except:
        default_headers = {}

    logger.info(f"[HTTP Tool] {method} {full_url}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=full_url,
                headers=default_headers,
                json=body if body else None
            )

            # Try to parse JSON response
            try:
                data = response.json()
            except:
                data = response.text

            return {
                "status": response.status_code,
                "data": data,
                "url": full_url,
                "method": method
            }

    except httpx.TimeoutException:
        return {"error": "Request timed out"}
    except httpx.ConnectError as e:
        return {"error": f"Connection failed: {str(e)}"}
    except Exception as e:
        logger.error(f"[HTTP Tool] Error: {e}")
        return {"error": str(e)}


async def _execute_python_code(args: Dict[str, Any],
                                node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Python code (dual-purpose: workflow node + AI tool).

    Args:
        args: Dict with 'code' from LLM (when used as AI tool)
        node_params: Node parameters containing code (when used as workflow node), timeout, etc.

    Returns:
        Dict with success, result, output, or error
    """
    import subprocess
    import tempfile
    import os

    # Get code from LLM args first (AI tool mode), fall back to node parameters (workflow mode)
    code = args.get('code', '') or node_params.get('code', '')
    timeout = int(node_params.get('timeout', 30))

    if not code:
        return {"error": "No code provided. When using as AI tool, the LLM must provide the 'code' argument with Python code to execute."}

    # Wrap code to capture output and result
    wrapped_code = f'''
import json
import sys
import math
from datetime import datetime, timedelta
from collections import Counter, defaultdict

input_data = {{}}
output = None
_stdout_lines = []

class _PrintCapture:
    def write(self, text):
        if text.strip():
            _stdout_lines.append(text.rstrip())
    def flush(self):
        pass

_old_stdout = sys.stdout
sys.stdout = _PrintCapture()

try:
{chr(10).join("    " + line for line in code.split(chr(10)))}

    sys.stdout = _old_stdout
    result = {{"success": True}}
    if output is not None:
        result["result"] = output
    if _stdout_lines:
        result["output"] = chr(10).join(_stdout_lines)
    print(json.dumps(result, default=str))
except Exception as e:
    sys.stdout = _old_stdout
    print(json.dumps({{"error": str(e)}}))
'''

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(wrapped_code)
        temp_path = f.name

    try:
        logger.info(f"[Python Tool] Executing code (timeout: {timeout}s)")
        result = subprocess.run(
            ['python', temp_path],
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode == 0:
            try:
                return json.loads(result.stdout.strip())
            except:
                return {"success": True, "output": result.stdout.strip()}
        else:
            return {"error": result.stderr or "Python execution failed"}

    except subprocess.TimeoutExpired:
        return {"error": f"Python execution timed out after {timeout} seconds"}
    except Exception as e:
        logger.error(f"[Python Tool] Error: {e}")
        return {"error": str(e)}
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


async def _execute_javascript_code(args: Dict[str, Any],
                                    node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute JavaScript code (dual-purpose: workflow node + AI tool).

    Args:
        args: Dict with 'code' from LLM (when used as AI tool)
        node_params: Node parameters containing code (when used as workflow node), timeout, etc.

    Returns:
        Dict with success, result, output, or error
    """
    import subprocess
    import tempfile
    import os

    # Get code from LLM args first (AI tool mode), fall back to node parameters (workflow mode)
    code = args.get('code', '') or node_params.get('code', '')
    timeout = int(node_params.get('timeout', 30))

    if not code:
        return {"error": "No code provided. When using as AI tool, the LLM must provide the 'code' argument with JavaScript code to execute."}

    # Wrap code to capture output and result
    wrapped_code = f'''
const input_data = {{}};
let output = undefined;
const _stdout_lines = [];

const _originalLog = console.log;
console.log = (...args) => {{
    _stdout_lines.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
}};

try {{
{chr(10).join("    " + line for line in code.split(chr(10)))}

    const result = {{ success: true }};
    if (output !== undefined) {{
        result.result = output;
    }}
    if (_stdout_lines.length > 0) {{
        result.output = _stdout_lines.join('\\n');
    }}
    _originalLog(JSON.stringify(result));
}} catch (e) {{
    _originalLog(JSON.stringify({{ error: e.message }}));
}}
'''

    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(wrapped_code)
        temp_path = f.name

    try:
        logger.info(f"[JavaScript Tool] Executing code (timeout: {timeout}s)")
        result = subprocess.run(
            ['node', temp_path],
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode == 0:
            try:
                return json.loads(result.stdout.strip())
            except:
                return {"success": True, "output": result.stdout.strip()}
        else:
            return {"error": result.stderr or "JavaScript execution failed"}

    except subprocess.TimeoutExpired:
        return {"error": f"JavaScript execution timed out after {timeout} seconds"}
    except FileNotFoundError:
        return {"error": "Node.js is not installed. Cannot execute JavaScript code."}
    except Exception as e:
        logger.error(f"[JavaScript Tool] Error: {e}")
        return {"error": str(e)}
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass


async def _execute_current_time(args: Dict[str, Any],
                                 node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Get current date and time.

    Args:
        args: Dict with optional 'timezone'
        node_params: Node parameters containing default timezone

    Returns:
        Dict with datetime, date, time, timezone, day_of_week, timestamp
    """
    from datetime import datetime
    import pytz

    timezone_str = args.get('timezone') or node_params.get('timezone', 'UTC')

    try:
        tz = pytz.timezone(timezone_str)
        now = datetime.now(tz)

        result = {
            "datetime": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "timezone": timezone_str,
            "day_of_week": now.strftime("%A"),
            "timestamp": int(now.timestamp())
        }
        logger.info(f"[CurrentTime] {timezone_str}: {result['datetime']}")
        return result
    except Exception as e:
        logger.error(f"[CurrentTime] Error: {e}")
        return {"error": f"Invalid timezone: {timezone_str}. Error: {str(e)}"}


async def _execute_web_search(args: Dict[str, Any],
                               node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute web search.

    Args:
        args: Dict with 'query'
        node_params: Node parameters containing provider, apiKey, maxResults

    Returns:
        Dict with query, results list, provider
    """
    import httpx
    import asyncio

    query = args.get('query', '')
    if not query:
        return {"error": "No search query provided"}

    provider = node_params.get('provider', 'duckduckgo')
    max_results = int(node_params.get('maxResults', 5))

    logger.info(f"[WebSearch] Searching '{query}' via {provider}")

    try:
        if provider == 'duckduckgo':
            # Use the ddgs library for proper web search results
            try:
                from ddgs import DDGS

                # Run synchronous DDGS in a thread pool to not block async
                def do_search():
                    ddgs = DDGS()
                    return list(ddgs.text(query, max_results=max_results))

                search_results = await asyncio.get_event_loop().run_in_executor(
                    None, do_search
                )

                results = []
                for item in search_results:
                    results.append({
                        "title": item.get('title', ''),
                        "snippet": item.get('body', ''),
                        "url": item.get('href', '')
                    })

                logger.info(f"[WebSearch] Found {len(results)} results via DuckDuckGo")
                return {
                    "query": query,
                    "results": results,
                    "provider": "duckduckgo"
                }

            except ImportError:
                logger.warning("[WebSearch] ddgs not installed, falling back to Instant Answer API")
                # Fallback to Instant Answer API (limited results)
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        "https://api.duckduckgo.com/",
                        params={"q": query, "format": "json", "no_html": 1}
                    )
                    data = response.json()

                    results = []
                    if data.get('AbstractText'):
                        results.append({
                            "title": data.get('Heading', 'Result'),
                            "snippet": data.get('AbstractText'),
                            "url": data.get('AbstractURL', '')
                        })

                    for topic in data.get('RelatedTopics', [])[:max_results]:
                        if isinstance(topic, dict) and 'Text' in topic:
                            results.append({
                                "title": topic.get('Text', '')[:50],
                                "snippet": topic.get('Text', ''),
                                "url": topic.get('FirstURL', '')
                            })

                    logger.info(f"[WebSearch] Found {len(results)} results (Instant Answer API fallback)")
                    return {
                        "query": query,
                        "results": results[:max_results],
                        "provider": "duckduckgo"
                    }

        elif provider == 'serper':
            api_key = node_params.get('apiKey', '')
            if not api_key:
                return {"error": "Serper API key required"}

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://google.serper.dev/search",
                    headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                    json={"q": query, "num": max_results}
                )
                data = response.json()

                results = []
                for item in data.get('organic', [])[:max_results]:
                    results.append({
                        "title": item.get('title', ''),
                        "snippet": item.get('snippet', ''),
                        "url": item.get('link', '')
                    })

                logger.info(f"[WebSearch] Found {len(results)} results via Serper")
                return {
                    "query": query,
                    "results": results,
                    "provider": "serper"
                }

        return {"error": f"Unknown search provider: {provider}"}

    except Exception as e:
        logger.error(f"[WebSearch] Error: {e}")
        return {"error": f"Search failed: {str(e)}"}


async def _execute_whatsapp_send(args: Dict[str, Any],
                                  node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Send WhatsApp message with full message type support.

    Supports all message types: text, image, video, audio, document, sticker, location, contact
    Recipients: phone number or group_id
    Media sources: URL

    Args:
        args: LLM-provided arguments matching WhatsAppSendSchema (snake_case)
        node_params: Node parameters (used as fallback)

    Returns:
        Dict with success status and message details
    """
    from services.handlers.whatsapp import handle_whatsapp_send

    # Args are snake_case matching Pydantic schema and frontend node params
    parameters = {
        'recipient_type': args.get('recipient_type', 'phone'),
        'phone': args.get('phone', ''),
        'group_id': args.get('group_id', ''),
        'message_type': args.get('message_type', 'text'),
        'message': args.get('message', ''),
        'media_source': 'url' if args.get('media_url') else 'none',
        'media_url': args.get('media_url', ''),
        'caption': args.get('caption', ''),
        'latitude': args.get('latitude'),
        'longitude': args.get('longitude'),
        'location_name': args.get('location_name', ''),
        'address': args.get('address', ''),
        'contact_name': args.get('contact_name', ''),
        'vcard': args.get('vcard', ''),
    }

    # Validate required fields based on message type
    recipient_type = parameters['recipient_type']
    message_type = parameters['message_type']

    if recipient_type == 'phone' and not parameters['phone']:
        return {"error": "Phone number is required for recipient_type='phone'"}
    if recipient_type == 'group' and not parameters['group_id']:
        return {"error": "Group ID is required for recipient_type='group'"}
    if message_type == 'text' and not parameters['message']:
        return {"error": "Message content is required for message_type='text'"}
    if message_type in ('image', 'video', 'audio', 'document', 'sticker') and not parameters['media_url']:
        return {"error": f"media_url is required for message_type='{message_type}'"}
    if message_type == 'location' and (parameters['latitude'] is None or parameters['longitude'] is None):
        return {"error": "latitude and longitude are required for message_type='location'"}
    if message_type == 'contact' and not parameters['vcard']:
        return {"error": "vcard is required for message_type='contact'"}

    recipient = parameters['phone'] if recipient_type == 'phone' else parameters['group_id']
    logger.info(f"[WhatsApp Tool] Sending {message_type} to {recipient[:15]}...")

    try:
        result = await handle_whatsapp_send(
            node_id="tool_whatsapp_send",
            node_type="whatsappSend",
            parameters=parameters,
            context={}
        )

        if result.get('success'):
            return {
                "success": True,
                "recipient": recipient,
                "recipient_type": recipient_type,
                "message_type": message_type,
                "details": result.get('result', {})
            }
        else:
            return {"error": result.get('error', 'Unknown error')}

    except Exception as e:
        logger.error(f"[WhatsApp Tool] Error: {e}")
        return {"error": f"WhatsApp send failed: {str(e)}"}


async def _execute_whatsapp_db(args: Dict[str, Any],
                               node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Query WhatsApp database - contacts, groups, messages.

    Supports 6 operations:
    - chat_history: Retrieve messages from a chat
    - search_groups: Search groups by name
    - get_group_info: Get group details with participant names
    - get_contact_info: Get full contact info (for send/reply)
    - list_contacts: List contacts with saved names
    - check_contacts: Check WhatsApp registration status

    Args:
        args: LLM-provided arguments matching WhatsAppDbSchema (snake_case)
        node_params: Node parameters (used as fallback)

    Returns:
        Dict with operation-specific results
    """
    from services.handlers.whatsapp import handle_whatsapp_db

    operation = args.get('operation', 'chat_history')
    logger.info(f"[WhatsApp DB Tool] Executing operation: {operation}")

    # Build parameters for handler (snake_case matching frontend nodes)
    parameters = {'operation': operation}

    if operation == 'chat_history':
        parameters.update({
            'chat_type': args.get('chat_type', 'individual'),
            'phone': args.get('phone', ''),
            'group_id': args.get('group_id', ''),
            'message_filter': args.get('message_filter', 'all'),
            'group_filter': args.get('group_filter', 'all'),
            'sender_phone': args.get('sender_phone', ''),
            'limit': args.get('limit', 50),
            'offset': args.get('offset', 0),
        })
        # Validate required fields
        chat_type = parameters['chat_type']
        if chat_type == 'individual' and not parameters['phone']:
            return {"error": "Phone number is required for chat_type='individual'"}
        if chat_type == 'group' and not parameters['group_id']:
            return {"error": "Group ID is required for chat_type='group'"}

    elif operation == 'search_groups':
        parameters['query'] = args.get('query', '')
        parameters['limit'] = min(args.get('limit', 20), 50)  # Cap at 50 to prevent overflow

    elif operation == 'get_group_info':
        group_id = args.get('group_id', '')
        if not group_id:
            return {"error": "group_id is required for get_group_info"}
        parameters['group_id_for_info'] = group_id
        parameters['participant_limit'] = min(args.get('participant_limit', 50), 100)  # Cap at 100

    elif operation == 'get_contact_info':
        phone = args.get('phone', '')
        if not phone:
            return {"error": "phone is required for get_contact_info"}
        parameters['contact_phone'] = phone

    elif operation == 'list_contacts':
        parameters['query'] = args.get('query', '')
        parameters['limit'] = min(args.get('limit', 50), 100)  # Cap at 100 to prevent overflow

    elif operation == 'check_contacts':
        phones = args.get('phones', '')
        if not phones:
            return {"error": "phones (comma-separated) is required for check_contacts"}
        parameters['phones'] = phones

    else:
        return {"error": f"Unknown operation: {operation}"}

    try:
        result = await handle_whatsapp_db(
            node_id="tool_whatsapp_db",
            node_type="whatsappDb",
            parameters=parameters,
            context={}
        )

        if result.get('success'):
            # Return the result section for LLM consumption
            return {
                "success": True,
                "operation": operation,
                **result.get('result', {})
            }
        else:
            return {"error": result.get('error', 'Unknown error')}

    except Exception as e:
        logger.error(f"[WhatsApp DB Tool] Error: {e}")
        return {"error": f"WhatsApp DB operation failed: {str(e)}"}


async def _execute_android_toolkit(args: Dict[str, Any],
                                    config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Android toolkit by routing to connected service.

    Follows n8n Sub-Node execution pattern - the toolkit routes
    to the appropriate connected Android service node.

    Uses the existing AndroidService which handles both relay (remote)
    and local HTTP connections automatically.

    Args:
        args: LLM-provided arguments {service_id, action, parameters}
        config: Toolkit config with connected_services list

    Returns:
        Service execution result
    """
    from services.android_service import AndroidService
    from services.status_broadcaster import get_status_broadcaster

    service_id = args.get('service_id', '')
    action = args.get('action', '')
    parameters = args.get('parameters') or {}

    connected_services = config.get('connected_services', [])

    # Validate service_id provided
    if not service_id:
        available = [s.get('service_id') or s.get('node_type') for s in connected_services]
        return {
            "error": "No service_id provided",
            "hint": f"Available services: {', '.join(available)}" if available else "No services connected"
        }

    # Find matching connected service
    target_service = None
    for svc in connected_services:
        svc_id = svc.get('service_id') or svc.get('node_type')
        if svc_id == service_id:
            target_service = svc
            break

    if not target_service:
        available = [s.get('service_id') or s.get('node_type') for s in connected_services]
        return {
            "error": f"Service '{service_id}' not connected to toolkit",
            "available_services": available
        }

    # Get connection parameters from connected Android node
    svc_params = target_service.get('parameters', {})
    host = svc_params.get('android_host', 'localhost')
    port = int(svc_params.get('android_port', 8888))

    # Use provided action, or fall back to node's default action
    if not action:
        action = svc_params.get('action') or target_service.get('action', 'status')

    # Get the connected service's node_id for status broadcast
    service_node_id = target_service.get('node_id')
    # Get workflow_id from config for proper status scoping
    workflow_id = config.get('workflow_id')

    logger.info(f"[Android Toolkit] Executing {service_id}.{action} via '{target_service.get('label')}' (node: {service_node_id}, workflow: {workflow_id})")

    # Broadcast executing status for the connected Android service node
    # This makes the SquareNode show the animation
    broadcaster = get_status_broadcaster()
    if service_node_id:
        await broadcaster.update_node_status(
            service_node_id,
            "executing",
            {"message": f"Executing {action} via AI Agent toolkit"},
            workflow_id=workflow_id
        )

    try:
        # Use AndroidService which handles relay vs local connection automatically
        android_service = AndroidService()
        result = await android_service.execute_service(
            node_id=config.get('node_id', 'toolkit'),
            service_id=service_id,
            action=action,
            parameters=parameters,
            android_host=host,
            android_port=port
        )

        # Broadcast success/error status for the connected service node
        if service_node_id:
            if result.get('success'):
                await broadcaster.update_node_status(
                    service_node_id,
                    "success",
                    {"message": f"{action} completed", "result": result.get('result', {})},
                    workflow_id=workflow_id
                )
            else:
                await broadcaster.update_node_status(
                    service_node_id,
                    "error",
                    {"message": result.get('error', 'Unknown error')},
                    workflow_id=workflow_id
                )

        # Extract and return the relevant data
        if result.get('success'):
            return {
                "success": True,
                "service": service_id,
                "action": action,
                "data": result.get('result', {}).get('data', result.get('result', {}))
            }
        else:
            return {
                "error": result.get('error', 'Unknown error'),
                "service": service_id,
                "action": action
            }

    except Exception as e:
        logger.error(f"[Android Toolkit] Unexpected error: {e}")
        # Broadcast error status for the connected service node
        if service_node_id:
            await broadcaster.update_node_status(
                service_node_id,
                "error",
                {"message": str(e)},
                workflow_id=workflow_id
            )
        return {"error": str(e)}


async def _execute_android_service(args: Dict[str, Any],
                                   config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a direct Android service node (not via toolkit).

    This handles Android service nodes (batteryMonitor, wifiAutomation, etc.)
    connected directly to the AI Agent's input-tools handle.

    Args:
        args: LLM-provided arguments {action, parameters}
        config: Tool config with node_type, node_id, parameters

    Returns:
        Service execution result
    """
    from services.android_service import AndroidService
    from services.status_broadcaster import get_status_broadcaster

    node_type = config.get('node_type', '')
    node_id = config.get('node_id', '')
    node_params = config.get('parameters', {})
    workflow_id = config.get('workflow_id')

    # Map node type to service_id (convert camelCase to snake_case)
    # e.g., batteryMonitor -> battery, wifiAutomation -> wifi_automation
    service_id_map = {
        'batteryMonitor': 'battery',
        'networkMonitor': 'network',
        'systemInfo': 'system_info',
        'location': 'location',
        'appLauncher': 'app_launcher',
        'appList': 'app_list',
        'wifiAutomation': 'wifi_automation',
        'bluetoothAutomation': 'bluetooth_automation',
        'audioAutomation': 'audio_automation',
        'deviceStateAutomation': 'device_state',
        'screenControlAutomation': 'screen_control',
        'airplaneModeControl': 'airplane_mode',
        'motionDetection': 'motion_detection',
        'environmentalSensors': 'environmental_sensors',
        'cameraControl': 'camera_control',
        'mediaControl': 'media_control',
    }
    service_id = service_id_map.get(node_type, node_type)

    # Get action from LLM args or fall back to node params or default
    action = args.get('action') or node_params.get('action', 'status')
    parameters = args.get('parameters') or {}

    # Get connection parameters from node
    host = node_params.get('android_host', 'localhost')
    port = int(node_params.get('android_port', 8888))

    logger.info(f"[Android Service] Executing {service_id}.{action} (node: {node_id}, workflow: {workflow_id})")

    # Broadcast executing status
    broadcaster = get_status_broadcaster()
    if node_id:
        await broadcaster.update_node_status(
            node_id,
            "executing",
            {"message": f"Executing {action} via AI Agent"},
            workflow_id=workflow_id
        )

    try:
        # Use AndroidService which handles relay vs local connection automatically
        android_service = AndroidService()
        result = await android_service.execute_service(
            node_id=node_id,
            service_id=service_id,
            action=action,
            parameters=parameters,
            android_host=host,
            android_port=port
        )

        # Broadcast success/error status
        if node_id:
            if result.get('success'):
                await broadcaster.update_node_status(
                    node_id,
                    "success",
                    {"message": f"{action} completed", "result": result.get('result', {})},
                    workflow_id=workflow_id
                )
            else:
                await broadcaster.update_node_status(
                    node_id,
                    "error",
                    {"message": result.get('error', 'Unknown error')},
                    workflow_id=workflow_id
                )

        # Extract and return the relevant data
        if result.get('success'):
            return {
                "success": True,
                "service": service_id,
                "action": action,
                "data": result.get('result', {}).get('data', result.get('result', {}))
            }
        else:
            return {
                "error": result.get('error', 'Unknown error'),
                "service": service_id,
                "action": action
            }

    except Exception as e:
        logger.error(f"[Android Service] Unexpected error: {e}")
        if node_id:
            await broadcaster.update_node_status(
                node_id,
                "error",
                {"message": str(e)},
                workflow_id=workflow_id
            )
        return {"error": str(e)}


async def _execute_geocoding(args: Dict[str, Any],
                              node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Google Maps geocoding (gmaps_locations node as tool).

    Args:
        args: LLM-provided arguments (snake_case: service_type, address, lat, lng)
        node_params: Node parameters (may contain api_key)

    Returns:
        Geocoding result with coordinates or address
    """
    from services.handlers.utility import handle_add_locations
    from core.container import container

    # Fetch API key from database (source of truth)
    auth_service = container.auth_service()
    api_key = await auth_service.get_api_key("google_maps", "default") or ''

    # Args use snake_case matching Pydantic schema and node params
    parameters = {**args, 'api_key': api_key}

    service_type = parameters.get('service_type', 'geocode')

    # Validate required fields
    if service_type == 'geocode' and not parameters.get('address'):
        return {"error": "address is required for geocoding"}
    if service_type == 'reverse_geocode':
        if parameters.get('lat') is None or parameters.get('lng') is None:
            return {"error": "lat and lng are required for reverse geocoding"}

    lat, lng = parameters.get('lat'), parameters.get('lng')
    location_str = parameters.get('address') or f"({lat}, {lng})"
    logger.info(f"[Geocoding Tool] {service_type}: {location_str}")

    try:
        maps_service = container.maps_service()
        result = await handle_add_locations(
            node_id="tool_geocoding",
            node_type="gmaps_locations",
            parameters=parameters,
            context={},
            maps_service=maps_service
        )

        if result.get('success'):
            return {"success": True, "service_type": service_type, **result.get('result', {})}
        else:
            return {"error": result.get('error', 'Geocoding failed')}

    except Exception as e:
        logger.error(f"[Geocoding Tool] Error: {e}")
        return {"error": f"Geocoding failed: {str(e)}"}


async def _execute_nearby_places(args: Dict[str, Any],
                                  node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Google Maps nearby places search (gmaps_nearby_places node as tool).

    Args:
        args: LLM-provided arguments (snake_case: lat, lng, radius, type, keyword)
        node_params: Node parameters (may contain api_key)

    Returns:
        Nearby places search results
    """
    from services.handlers.utility import handle_nearby_places
    from core.container import container

    # Fetch API key from database (source of truth)
    auth_service = container.auth_service()
    api_key = await auth_service.get_api_key("google_maps", "default") or ''

    # Args use snake_case matching Pydantic schema and node params
    parameters = {**args, 'api_key': api_key}

    # Validate required fields
    if parameters.get('lat') is None or parameters.get('lng') is None:
        return {"error": "lat and lng are required for nearby places search"}

    place_type = parameters.get('type', 'restaurant')
    logger.info(f"[Nearby Places Tool] Searching {place_type} near ({parameters['lat']}, {parameters['lng']})")

    try:
        maps_service = container.maps_service()
        result = await handle_nearby_places(
            node_id="tool_nearby_places",
            node_type="gmaps_nearby_places",
            parameters=parameters,
            context={},
            maps_service=maps_service
        )

        if result.get('success'):
            return {"success": True, "type": place_type, **result.get('result', {})}
        else:
            return {"error": result.get('error', 'Nearby places search failed')}

    except Exception as e:
        logger.error(f"[Nearby Places Tool] Error: {e}")
        return {"error": f"Nearby places search failed: {str(e)}"}


async def _execute_generic(args: Dict[str, Any],
                           config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a generic tool (fallback handler).

    For node types without specific handlers, this returns the input
    along with node information.

    Args:
        args: Tool arguments
        config: Tool configuration

    Returns:
        Dict with input echoed and node info
    """
    return {
        "input": args.get('input', ''),
        "node_type": config.get('node_type'),
        "node_id": config.get('node_id'),
        "message": "Generic tool executed - no specific handler for this node type"
    }


async def _execute_delegated_agent(args: Dict[str, Any],
                                    config: Dict[str, Any]) -> Dict[str, Any]:
    """Delegate a task to a child AI Agent (fire-and-forget pattern).

    This spawns the child agent as an asyncio background task and returns
    immediately, allowing the parent agent to continue working.

    Args:
        args: Dict with 'task' and optional 'context'
        config: Tool config with node_id, node_type, parameters, ai_service, database,
                nodes, edges, workflow_id

    Returns:
        Immediate acknowledgment with task_id (child runs in background)
    """
    from services.status_broadcaster import get_status_broadcaster

    node_id = config.get('node_id')
    node_type = config.get('node_type')
    workflow_id = config.get('workflow_id')
    task_description = args.get('task', '')
    task_context = args.get('context', '')

    # Get injected services
    ai_service = config.get('ai_service')
    database = config.get('database')
    nodes = config.get('nodes', [])
    edges = config.get('edges', [])

    if not ai_service or not database:
        return {
            "error": "Agent delegation requires ai_service and database in config",
            "hint": "Ensure nodes/edges are passed to tool config"
        }

    # Generate unique task ID
    task_id = f"delegated_{node_id}_{uuid.uuid4().hex[:8]}"

    # Get child agent parameters from database
    child_params = await database.get_node_parameters(node_id) or {}

    # Build prompt from task + context
    full_prompt = task_description
    if task_context:
        full_prompt = f"{task_description}\n\nContext:\n{task_context}"
    child_params['prompt'] = full_prompt

    # Create execution context for child agent
    child_context = {
        'nodes': nodes,
        'edges': edges,
        'workflow_id': workflow_id,
        'outputs': {},
        'parent_task_id': task_id
    }

    broadcaster = get_status_broadcaster()
    agent_label = child_params.get('label', node_type)

    logger.info(f"[Delegated Agent] Starting task {task_id} for '{agent_label}' (node: {node_id})")

    # Define the background coroutine
    async def run_child_agent():
        try:
            # Broadcast that child agent is starting
            await broadcaster.update_node_status(
                node_id,
                "executing",
                {
                    "phase": "delegated_task",
                    "task_id": task_id,
                    "message": f"Working on: {task_description[:100]}..."
                },
                workflow_id=workflow_id
            )

            # Execute the child agent
            if node_type == 'aiAgent':
                from services.handlers.ai import handle_ai_agent
                result = await handle_ai_agent(
                    node_id, node_type, child_params, child_context, ai_service, database
                )
            else:
                from services.handlers.ai import handle_chat_agent
                result = await handle_chat_agent(
                    node_id, node_type, child_params, child_context, ai_service, database
                )

            logger.info(f"[Delegated Agent] Task {task_id} completed: success={result.get('success')}")

            # Broadcast completion
            response_preview = str(result.get('result', {}).get('response', ''))[:200]
            await broadcaster.update_node_status(
                node_id,
                "success",
                {
                    "phase": "delegated_complete",
                    "task_id": task_id,
                    "result_summary": response_preview
                },
                workflow_id=workflow_id
            )

            return result

        except Exception as e:
            logger.error(f"[Delegated Agent] Task {task_id} failed: {e}")
            await broadcaster.update_node_status(
                node_id,
                "error",
                {
                    "phase": "delegated_error",
                    "task_id": task_id,
                    "error": str(e)
                },
                workflow_id=workflow_id
            )
            return {"success": False, "error": str(e)}

        finally:
            # Cleanup task reference
            _delegated_tasks.pop(task_id, None)

    # Spawn as background task (fire-and-forget)
    task = asyncio.create_task(run_child_agent())
    _delegated_tasks[task_id] = task

    # Return immediately - Parent agent continues working
    return {
        "success": True,
        "status": "delegated",
        "task_id": task_id,
        "agent_node_id": node_id,
        "agent_name": agent_label,
        "message": f"Task delegated to '{agent_label}'. Agent is now working independently on: {task_description[:100]}..."
    }


def get_delegated_task_status(task_id: str) -> Dict[str, Any]:
    """Check status of a delegated task (optional utility).

    Args:
        task_id: The task_id returned from delegation

    Returns:
        Status dict with task state
    """
    task = _delegated_tasks.get(task_id)

    if task is None:
        return {"status": "not_found_or_completed", "task_id": task_id}
    elif task.done():
        return {"status": "completed", "task_id": task_id}
    else:
        return {"status": "running", "task_id": task_id}
