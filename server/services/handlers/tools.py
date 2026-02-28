"""Tool execution handlers for AI Agent tool calling.

This module contains handlers for executing tools called by the AI Agent.
Each tool type has its own handler function that processes the tool call
and returns results.
"""

import math
import json
import asyncio
import uuid
import hashlib
from typing import Dict, Any, Optional, List, Tuple, TYPE_CHECKING

from core.logging import get_logger
from constants import ANDROID_SERVICE_NODE_TYPES

if TYPE_CHECKING:
    pass

logger = get_logger(__name__)

# Track running delegated tasks for status checking
_delegated_tasks: Dict[str, asyncio.Task] = {}

# In-memory cache of delegation results (fast path, survives task cleanup)
# Follows Celery AsyncResult / Ray ObjectRef pattern
_delegation_results: Dict[str, Dict[str, Any]] = {}

# Track active delegations to prevent duplicate calls: (parent_node_id, child_node_id, task_hash) -> task_id
_active_delegations: Dict[Tuple[str, str, str], str] = {}


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

    logger.debug(f"[Tool] Executing tool '{tool_name}' (node_type: {node_type})")

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

    # DuckDuckGo search tool (free, no API key)
    if node_type == 'duckduckgoSearch':
        return await _execute_duckduckgo_search(tool_args, config.get('parameters', {}))

    # Timer tool (dual-purpose: workflow node + AI tool)
    # LLM fills duration/unit via Pydantic schema; calls existing handle_timer handler
    if node_type == 'timer':
        from services.handlers.utility import handle_timer
        parameters = {**config.get('parameters', {}), **tool_args}
        return await handle_timer(
            node_id=config.get('node_id', 'tool_timer'),
            node_type='timer',
            parameters=parameters,
            context={}
        )

    # Cron Scheduler tool (dual-purpose: workflow node + AI tool)
    # LLM fills schedule params via CronSchedulerParams schema; calls existing handler
    if node_type == 'cronScheduler':
        from services.handlers.utility import handle_cron_scheduler
        parameters = {**config.get('parameters', {}), **tool_args}
        return await handle_cron_scheduler(
            node_id=config.get('node_id', 'tool_cron_scheduler'),
            node_type='cronScheduler',
            parameters=parameters,
            context={}
        )

    # WhatsApp send (existing node used as tool)
    if node_type == 'whatsappSend':
        return await _execute_whatsapp_send(tool_args, config.get('parameters', {}))

    # WhatsApp DB (existing node used as tool) - query contacts, groups, messages
    if node_type == 'whatsappDb':
        return await _execute_whatsapp_db(tool_args, config.get('parameters', {}))

    # Twitter Send (dual-purpose: workflow node + AI tool)
    if node_type == 'twitterSend':
        return await _execute_twitter_send(tool_args, config.get('parameters', {}))

    # Twitter Search (dual-purpose: workflow node + AI tool)
    if node_type == 'twitterSearch':
        return await _execute_twitter_search(tool_args, config.get('parameters', {}))

    # Twitter User (dual-purpose: workflow node + AI tool)
    if node_type == 'twitterUser':
        return await _execute_twitter_user(tool_args, config.get('parameters', {}))

    # ========================================================================
    # GOOGLE WORKSPACE TOOLS (consolidated: gmail, calendar, drive, sheets, tasks, contacts)
    # ========================================================================

    if node_type == 'gmail':
        return await _execute_google_gmail(tool_args, config.get('parameters', {}))
    if node_type == 'calendar':
        return await _execute_google_calendar(tool_args, config.get('parameters', {}))
    if node_type == 'drive':
        return await _execute_google_drive(tool_args, config.get('parameters', {}))
    if node_type == 'sheets':
        return await _execute_google_sheets(tool_args, config.get('parameters', {}))
    if node_type == 'tasks':
        return await _execute_google_tasks(tool_args, config.get('parameters', {}))
    if node_type == 'contacts':
        return await _execute_google_contacts(tool_args, config.get('parameters', {}))

    # Android toolkit - routes to connected service nodes
    if node_type == 'androidTool':
        return await _execute_android_toolkit(tool_args, config)

    # Direct Android service node (connected directly to AI Agent tools handle)
    if node_type in ANDROID_SERVICE_NODE_TYPES:
        return await _execute_android_service(tool_args, config)

    # Brave Search (dual-purpose: workflow node + AI tool)
    if node_type == 'braveSearch':
        return await _execute_brave_search_tool(tool_args, config.get('parameters', {}))

    # Serper Search (dual-purpose: workflow node + AI tool)
    if node_type == 'serperSearch':
        return await _execute_serper_search_tool(tool_args, config.get('parameters', {}))

    # Perplexity Search (dual-purpose: workflow node + AI tool)
    if node_type == 'perplexitySearch':
        return await _execute_perplexity_search_tool(tool_args, config.get('parameters', {}))

    # Google Maps Geocoding (gmaps_locations node as tool)
    if node_type == 'gmaps_locations':
        return await _execute_geocoding(tool_args, config.get('parameters', {}))

    # Google Maps Nearby Places (gmaps_nearby_places node as tool)
    if node_type == 'gmaps_nearby_places':
        return await _execute_nearby_places(tool_args, config.get('parameters', {}))

    # Task Manager (dual-purpose: AI tool + workflow node)
    if node_type == 'taskManager':
        return await _execute_task_manager(tool_args, config)

    # Apify Actor (dual-purpose: workflow node + AI tool)
    if node_type == 'apifyActor':
        return await _execute_apify_actor(tool_args, config.get('parameters', {}))

    # Crawlee web scraper (dual-purpose: workflow node + AI tool)
    if node_type == 'crawleeScraper':
        return await _execute_crawlee_scraper(tool_args, config.get('parameters', {}))

    # Proxy nodes (dual-purpose: workflow node + AI tool)
    if node_type == 'proxyRequest':
        return await _execute_proxy_request(tool_args, config.get('parameters', {}), config)
    if node_type == 'proxyStatus':
        return await _execute_proxy_status(tool_args, config.get('parameters', {}))
    if node_type == 'proxyConfig':
        return await _execute_proxy_config(tool_args, config.get('parameters', {}))

    # Built-in: Check delegated task results
    # Auto-injected when parent has delegation tools
    if node_type == '_builtin_check_delegated_tasks':
        return await _execute_check_delegated_tasks(tool_args, config)

    # AI Agent delegation (fire-and-forget async delegation)
    # Includes specialized agents: android_agent, coding_agent, web_agent, task_agent, social_agent, autonomous_agent
    if node_type in ('aiAgent', 'chatAgent', 'android_agent', 'coding_agent', 'web_agent', 'task_agent', 'social_agent', 'travel_agent', 'tool_agent', 'productivity_agent', 'payments_agent', 'consumer_agent', 'autonomous_agent', 'orchestrator_agent'):
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
        logger.debug(f"[Calculator] {operation}({a}, {b}) = {result}")
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
    except Exception:
        default_headers = {}

    # Transparent proxy injection (useProxy from node params or LLM args)
    proxy_url = None
    use_proxy = args.get('useProxy', node_params.get('useProxy', False))
    if use_proxy:
        try:
            from services.proxy.service import get_proxy_service
            proxy_svc = get_proxy_service()
            if proxy_svc and proxy_svc.is_enabled():
                merged = {**node_params, **args}
                proxy_url = await proxy_svc.get_proxy_url(full_url, merged)
        except Exception as e:
            logger.warning(f"[HTTP Tool] Proxy lookup failed, proceeding without proxy: {e}")

    logger.debug(f"[HTTP Tool] {method} {full_url}", proxy=bool(proxy_url))

    try:
        client_kwargs: dict = {"timeout": 30.0}
        if proxy_url:
            client_kwargs["proxy"] = proxy_url

        async with httpx.AsyncClient(**client_kwargs) as client:
            response = await client.request(
                method=method,
                url=full_url,
                headers=default_headers,
                json=body if body else None
            )

            # Try to parse JSON response
            try:
                data = response.json()
            except Exception:
                data = response.text

            return {
                "status": response.status_code,
                "data": data,
                "url": full_url,
                "method": method,
                "proxied": proxy_url is not None,
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
        logger.debug(f"[Python Tool] Executing code (timeout: {timeout}s)")
        result = subprocess.run(
            ['python', temp_path],
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode == 0:
            try:
                return json.loads(result.stdout.strip())
            except Exception:
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
        except Exception:
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
        logger.debug(f"[JavaScript Tool] Executing code (timeout: {timeout}s)")
        result = subprocess.run(
            ['node', temp_path],
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode == 0:
            try:
                return json.loads(result.stdout.strip())
            except Exception:
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
        except Exception:
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
        logger.debug(f"[CurrentTime] {timezone_str}: {result['datetime']}")
        return result
    except Exception as e:
        logger.error(f"[CurrentTime] Error: {e}")
        return {"error": f"Invalid timezone: {timezone_str}. Error: {str(e)}"}


async def _execute_duckduckgo_search(args: Dict[str, Any],
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
    Recipients: phone number, group_id, or channel_jid (newsletter)
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
        'channel_jid': args.get('channel_jid', ''),
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
    if recipient_type == 'channel' and not parameters['channel_jid']:
        return {"error": "Channel JID is required for recipient_type='channel'"}
    if recipient_type == 'channel' and message_type not in ('text', 'image', 'video', 'audio', 'document'):
        return {"error": f"Channels only support: text, image, video, audio, document. Got: {message_type}"}
    if message_type == 'text' and not parameters['message']:
        return {"error": "Message content is required for message_type='text'"}
    if message_type in ('image', 'video', 'audio', 'document', 'sticker') and not parameters['media_url']:
        return {"error": f"media_url is required for message_type='{message_type}'"}
    if message_type == 'location' and (parameters['latitude'] is None or parameters['longitude'] is None):
        return {"error": "latitude and longitude are required for message_type='location'"}
    if message_type == 'contact' and not parameters['vcard']:
        return {"error": "vcard is required for message_type='contact'"}

    if recipient_type == 'channel':
        recipient = parameters['channel_jid']
    elif recipient_type == 'phone':
        recipient = parameters['phone']
    else:
        recipient = parameters['group_id']
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

    Supports 13 operations:
    - chat_history: Retrieve messages from a chat
    - search_groups: Search groups by name
    - get_group_info: Get group details with participant names
    - get_contact_info: Get full contact info (for send/reply)
    - list_contacts: List contacts with saved names
    - check_contacts: Check WhatsApp registration status
    - list_channels: List subscribed newsletter channels
    - get_channel_info: Get channel details
    - channel_messages: Get channel message history
    - channel_stats: Get channel subscriber/view stats
    - channel_follow: Follow/subscribe to a channel
    - channel_unfollow: Unfollow/unsubscribe from a channel
    - channel_create: Create a new newsletter channel

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

    elif operation == 'list_channels':
        if args.get('refresh'):
            parameters['refresh'] = True
        parameters['limit'] = min(args.get('limit', 20), 50)

    elif operation == 'get_channel_info':
        channel_jid = args.get('channel_jid', '')
        if not channel_jid:
            return {"error": "channel_jid is required for get_channel_info"}
        parameters['channel_jid'] = channel_jid
        if args.get('refresh'):
            parameters['refresh'] = True

    elif operation == 'channel_messages':
        channel_jid = args.get('channel_jid', '')
        if not channel_jid:
            return {"error": "channel_jid is required for channel_messages"}
        parameters['channel_jid'] = channel_jid
        parameters['channel_count'] = min(args.get('channel_count', 20), 100)
        if args.get('before_server_id'):
            parameters['before_server_id'] = args['before_server_id']

    elif operation == 'channel_stats':
        channel_jid = args.get('channel_jid', '')
        if not channel_jid:
            return {"error": "channel_jid is required for channel_stats"}
        parameters['channel_jid'] = channel_jid
        parameters['channel_count'] = min(args.get('channel_count', 10), 100)

    elif operation == 'channel_follow':
        channel_jid = args.get('channel_jid', '')
        if not channel_jid:
            return {"error": "channel_jid is required for channel_follow"}
        parameters['channel_jid'] = channel_jid

    elif operation == 'channel_unfollow':
        channel_jid = args.get('channel_jid', '')
        if not channel_jid:
            return {"error": "channel_jid is required for channel_unfollow"}
        parameters['channel_jid'] = channel_jid

    elif operation == 'channel_create':
        channel_name = args.get('channel_name', '')
        if not channel_name:
            return {"error": "channel_name is required for channel_create"}
        parameters['channel_name'] = channel_name
        if args.get('channel_description'):
            parameters['channel_description'] = args['channel_description']

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


async def _execute_twitter_send(args: Dict[str, Any],
                                 node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Twitter send action via XDK SDK.

    Args:
        args: LLM-provided arguments (action, text, tweet_id, reply_to_id)
        node_params: Node parameters

    Returns:
        Twitter API result
    """
    from services.handlers.twitter import handle_twitter_send

    parameters = {**node_params, **args}
    # Handle reply_to_id alias
    if args.get('reply_to_id') and not args.get('tweet_id'):
        parameters['tweet_id'] = args['reply_to_id']

    return await handle_twitter_send(
        node_id="tool_twitter_send",
        node_type="twitterSend",
        parameters=parameters,
        context={}
    )


async def _execute_twitter_search(args: Dict[str, Any],
                                   node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Twitter search via XDK SDK.

    Args:
        args: LLM-provided arguments (query, max_results)
        node_params: Node parameters

    Returns:
        Search results
    """
    from services.handlers.twitter import handle_twitter_search

    parameters = {**node_params, **args}

    return await handle_twitter_search(
        node_id="tool_twitter_search",
        node_type="twitterSearch",
        parameters=parameters,
        context={}
    )


async def _execute_twitter_user(args: Dict[str, Any],
                                 node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Twitter user lookup via XDK SDK.

    Args:
        args: LLM-provided arguments (operation, username, user_id, max_results)
        node_params: Node parameters

    Returns:
        User data
    """
    from services.handlers.twitter import handle_twitter_user

    parameters = {**node_params, **args}

    return await handle_twitter_user(
        node_id="tool_twitter_user",
        node_type="twitterUser",
        parameters=parameters,
        context={}
    )


async def _execute_google_gmail(args: Dict[str, Any],
                                node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Gmail operations via consolidated dispatcher."""
    from services.handlers.gmail import handle_google_gmail

    parameters = {**node_params, **args}
    return await handle_google_gmail(
        node_id="tool_google_gmail",
        node_type="gmail",
        parameters=parameters,
        context={}
    )


# ============================================================================
# GOOGLE WORKSPACE CONSOLIDATED TOOL HANDLERS
# ============================================================================

async def _execute_google_calendar(args: Dict[str, Any],
                                   node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Google Calendar operations via consolidated dispatcher."""
    from services.handlers.calendar import handle_google_calendar

    parameters = {**node_params, **args}
    return await handle_google_calendar(
        node_id="tool_google_calendar",
        node_type="calendar",
        parameters=parameters,
        context={}
    )


async def _execute_google_drive(args: Dict[str, Any],
                                node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Google Drive operations via consolidated dispatcher."""
    from services.handlers.drive import handle_google_drive

    parameters = {**node_params, **args}
    return await handle_google_drive(
        node_id="tool_google_drive",
        node_type="drive",
        parameters=parameters,
        context={}
    )


async def _execute_google_sheets(args: Dict[str, Any],
                                 node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Google Sheets operations via consolidated dispatcher."""
    from services.handlers.sheets import handle_google_sheets

    parameters = {**node_params, **args}
    return await handle_google_sheets(
        node_id="tool_google_sheets",
        node_type="sheets",
        parameters=parameters,
        context={}
    )


async def _execute_google_tasks(args: Dict[str, Any],
                                node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Google Tasks operations via consolidated dispatcher."""
    from services.handlers.tasks import handle_google_tasks

    parameters = {**node_params, **args}
    return await handle_google_tasks(
        node_id="tool_google_tasks",
        node_type="tasks",
        parameters=parameters,
        context={}
    )


async def _execute_google_contacts(args: Dict[str, Any],
                                   node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Google Contacts operations via consolidated dispatcher."""
    from services.handlers.contacts import handle_google_contacts

    parameters = {**node_params, **args}
    return await handle_google_contacts(
        node_id="tool_google_contacts",
        node_type="contacts",
        parameters=parameters,
        context={}
    )


async def _execute_apify_actor(args: Dict[str, Any],
                               node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Apify actor via official SDK.

    Args:
        args: LLM-provided arguments (actor_id, input_json, max_results)
        node_params: Node parameters

    Returns:
        Apify actor run results
    """
    from services.handlers.apify import handle_apify_actor

    # Parse input_json string to dict if provided
    input_json = args.get('input_json', '{}')
    if isinstance(input_json, str):
        try:
            input_json = json.loads(input_json) if input_json.strip() else {}
        except json.JSONDecodeError:
            input_json = {}

    parameters = {
        **node_params,
        'actorId': args.get('actor_id', node_params.get('actorId', '')),
        'actorInput': input_json,
        'maxResults': args.get('max_results', node_params.get('maxResults', 100)),
    }

    return await handle_apify_actor(
        node_id="tool_apify_actor",
        node_type="apifyActor",
        parameters=parameters,
        context={}
    )


async def _execute_crawlee_scraper(args: Dict[str, Any],
                                    node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Crawlee web scraper as an AI tool.

    Maps LLM-provided arguments to node parameters and delegates to handler.
    """
    from services.handlers.crawlee import handle_crawlee_scraper

    parameters = {
        **node_params,
        'url': args.get('url', node_params.get('url', '')),
        'crawlerType': args.get('crawlerType', node_params.get('crawlerType', 'beautifulsoup')),
        'mode': args.get('mode', node_params.get('mode', 'single')),
        'cssSelector': args.get('cssSelector', node_params.get('cssSelector', '')),
        'maxPages': args.get('maxPages', node_params.get('maxPages', 10)),
        'outputFormat': args.get('outputFormat', node_params.get('outputFormat', 'text')),
        'useProxy': args.get('useProxy', node_params.get('useProxy', False)),
    }

    return await handle_crawlee_scraper(
        node_id="tool_crawlee_scraper",
        node_type="crawleeScraper",
        parameters=parameters,
        context={}
    )


async def _execute_proxy_request(args: Dict[str, Any],
                                 node_params: Dict[str, Any],
                                 config: Dict[str, Any]) -> Dict[str, Any]:
    """Execute proxy HTTP request as an AI tool.

    Delegates to the standalone proxy request handler.

    Args:
        args: LLM-provided arguments (url, method, headers, body, etc.)
        node_params: Node parameters
        config: Full tool config with context

    Returns:
        Request result dict
    """
    from services.handlers.proxy import handle_proxy_request

    # Merge LLM args over node params
    merged = {**node_params, **{k: v for k, v in args.items() if v is not None}}

    context = config.get('context', {})
    node_id = config.get('node_id', 'tool_proxy_request')

    result = await handle_proxy_request(node_id, 'proxyRequest', merged, context)
    return result.get('result', result)


async def _execute_proxy_status(args: Dict[str, Any],
                                node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute proxy status check as an AI tool.

    Delegates to the standalone proxy status handler.

    Args:
        args: LLM-provided arguments (providerFilter)
        node_params: Node parameters

    Returns:
        Status result dict
    """
    from services.handlers.proxy import handle_proxy_status

    merged = {**node_params, **{k: v for k, v in args.items() if v is not None}}

    result = await handle_proxy_status('tool_proxy_status', 'proxyStatus', merged, {})
    return result.get('result', result)


async def _execute_proxy_config(args: Dict[str, Any],
                                node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute proxy configuration operations.

    Manages proxy providers, credentials, and routing rules.

    Args:
        args: LLM-provided arguments (operation, name, etc.)
        node_params: Node parameters

    Returns:
        Operation result dict
    """
    import json as _json
    from core.container import container
    from services.proxy.service import get_proxy_service

    operation = args.get('operation', node_params.get('operation', ''))
    name = args.get('name', node_params.get('name', ''))
    proxy_svc = get_proxy_service()

    if operation == 'list_providers':
        providers = proxy_svc.get_providers() if proxy_svc else []
        return {"success": True, "operation": operation, "providers": [p.model_dump() for p in providers]}

    if operation == 'get_stats':
        stats = proxy_svc.get_stats() if proxy_svc else {}
        return {"success": True, "operation": operation, "stats": stats}

    if operation == 'list_routing_rules':
        rules = proxy_svc.get_routing_rules() if proxy_svc else []
        return {"success": True, "operation": operation, "rules": [r.model_dump() for r in rules]}

    if operation == 'add_provider':
        if not name:
            return {"success": False, "error": "Provider name is required"}
        gateway_host = args.get('gateway_host', node_params.get('gateway_host', ''))
        gateway_port = int(args.get('gateway_port', node_params.get('gateway_port', 0)))
        url_template_str = args.get('url_template', node_params.get('url_template', '{}'))
        cost_per_gb = float(args.get('cost_per_gb', node_params.get('cost_per_gb', 0)))
        enabled = args.get('enabled', node_params.get('enabled', True))
        priority = int(args.get('priority', node_params.get('priority', 50)))

        try:
            url_template = _json.loads(url_template_str) if isinstance(url_template_str, str) else url_template_str
        except _json.JSONDecodeError:
            return {"success": False, "error": f"Invalid url_template JSON: {url_template_str}"}

        db = container.database()
        await db.save_proxy_provider({
            "name": name,
            "enabled": enabled,
            "priority": priority,
            "cost_per_gb": cost_per_gb,
            "gateway_host": gateway_host,
            "gateway_port": gateway_port,
            "url_template": _json.dumps(url_template),
        })

        if proxy_svc:
            await proxy_svc.reload_providers()

        return {"success": True, "operation": operation, "name": name}

    if operation == 'update_provider':
        if not name:
            return {"success": False, "error": "Provider name is required"}
        db = container.database()
        existing = await db.get_proxy_provider(name)
        if not existing:
            return {"success": False, "error": f"Provider '{name}' not found"}

        updates = {}
        for field in ['gateway_host', 'gateway_port', 'cost_per_gb', 'enabled', 'priority']:
            val = args.get(field, node_params.get(field))
            if val is not None:
                updates[field] = val

        url_template_str = args.get('url_template', node_params.get('url_template'))
        if url_template_str:
            try:
                url_template = _json.loads(url_template_str) if isinstance(url_template_str, str) else url_template_str
                updates['url_template'] = _json.dumps(url_template)
            except _json.JSONDecodeError:
                return {"success": False, "error": f"Invalid url_template JSON"}

        if updates:
            merged = {**existing, **updates}
            await db.save_proxy_provider(merged)
            if proxy_svc:
                await proxy_svc.reload_providers()

        return {"success": True, "operation": operation, "name": name, "updated_fields": list(updates.keys())}

    if operation == 'remove_provider':
        if not name:
            return {"success": False, "error": "Provider name is required"}
        db = container.database()
        await db.delete_proxy_provider(name)
        if proxy_svc:
            await proxy_svc.reload_providers()
        return {"success": True, "operation": operation, "name": name}

    if operation == 'set_credentials':
        if not name:
            return {"success": False, "error": "Provider name is required"}
        username = args.get('username', node_params.get('username', ''))
        password = args.get('password', node_params.get('password', ''))
        if not username or not password:
            return {"success": False, "error": "Username and password are required"}

        auth_svc = container.auth_service()
        await auth_svc.store_api_key(f"proxy_{name}_username", username, [])
        await auth_svc.store_api_key(f"proxy_{name}_password", password, [])

        if proxy_svc:
            await proxy_svc.reload_providers()

        return {"success": True, "operation": operation, "name": name}

    if operation == 'test_provider':
        if not name:
            return {"success": False, "error": "Provider name is required"}
        if not proxy_svc:
            return {"success": False, "error": "Proxy service not enabled"}

        import time as _time
        import httpx

        try:
            proxy_url = await proxy_svc.get_proxy_url("https://httpbin.org/ip", {"proxyProvider": name})
            if not proxy_url:
                return {"success": False, "error": f"Could not get proxy URL for '{name}'"}

            start = _time.monotonic()
            async with httpx.AsyncClient(proxy=proxy_url, timeout=30) as client:
                resp = await client.get("https://httpbin.org/ip")
            latency_ms = (_time.monotonic() - start) * 1000

            try:
                data = resp.json()
                ip = data.get("origin", "unknown")
            except Exception:
                ip = "unknown"

            return {
                "success": resp.status_code == 200,
                "operation": operation,
                "name": name,
                "ip": ip,
                "latency_ms": round(latency_ms, 1),
                "status_code": resp.status_code,
            }
        except Exception as e:
            return {"success": False, "operation": operation, "name": name, "error": str(e)}

    if operation == 'add_routing_rule':
        domain_pattern = args.get('domain_pattern', node_params.get('domain_pattern', ''))
        if not domain_pattern:
            return {"success": False, "error": "domain_pattern is required"}

        preferred_str = args.get('preferred_providers', node_params.get('preferred_providers', '[]'))
        try:
            preferred = _json.loads(preferred_str) if isinstance(preferred_str, str) else preferred_str
        except _json.JSONDecodeError:
            preferred = []

        db = container.database()
        rule_data = {
            "domain_pattern": domain_pattern,
            "preferred_providers": _json.dumps(preferred),
            "required_country": args.get('required_country', node_params.get('required_country', '')),
            "session_type": args.get('session_type', node_params.get('session_type', 'rotating')),
        }
        await db.save_proxy_routing_rule(rule_data)

        if proxy_svc:
            await proxy_svc.reload_providers()

        return {"success": True, "operation": operation, "domain_pattern": domain_pattern}

    if operation == 'remove_routing_rule':
        rule_id = args.get('rule_id', node_params.get('rule_id'))
        if not rule_id:
            return {"success": False, "error": "rule_id is required"}

        db = container.database()
        await db.delete_proxy_routing_rule(int(rule_id))

        if proxy_svc:
            await proxy_svc.reload_providers()

        return {"success": True, "operation": operation, "rule_id": rule_id}

    return {"success": False, "error": f"Unknown operation: {operation}"}


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

    # Get parent node ID for duplicate tracking
    parent_node_id = config.get('parent_node_id', '')

    # Generate hash of task to detect duplicate delegation attempts
    task_hash = hashlib.md5(f"{task_description}:{task_context}".encode()).hexdigest()[:16]
    delegation_key = (parent_node_id, node_id, task_hash)

    # Check for duplicate delegation (prevents LLM from calling same delegation twice)
    existing_task_id = _active_delegations.get(delegation_key)
    if existing_task_id:
        logger.warning(f"[Delegated Agent] Duplicate delegation detected: task_hash={task_hash}, existing_task_id={existing_task_id}")
        return {
            "success": True,
            "status": "ALREADY_DELEGATED",
            "task_id": existing_task_id,
            "agent_name": config.get('parameters', {}).get('label', node_type),
            "result": (
                f"This task was ALREADY delegated (task_id: {existing_task_id}). "
                f"Do NOT call this tool again. Use 'check_delegated_tasks' to check status."
            ),
        }

    # Generate unique task ID
    task_id = f"delegated_{node_id}_{uuid.uuid4().hex[:8]}"

    # Register this delegation to prevent duplicates
    _active_delegations[delegation_key] = task_id

    # Get child agent parameters from database
    child_params = await database.get_node_parameters(node_id) or {}

    # Inject API key - delegated agents bypass NodeExecutor._inject_api_keys,
    # so we must resolve the key here from the credential store
    if not child_params.get('api_key') and not child_params.get('apiKey'):
        from constants import detect_ai_provider
        provider = detect_ai_provider(node_type, child_params)
        key = await ai_service.auth.get_api_key(provider, "default")
        if key:
            child_params['api_key'] = key
            logger.debug(f"[Delegated Agent] Injected API key for provider={provider}")

    # Inject default model if not set
    if not child_params.get('model'):
        from constants import detect_ai_provider
        provider = detect_ai_provider(node_type, child_params)
        models = await ai_service.auth.get_stored_models(provider, "default")
        if models:
            child_params['model'] = models[0]

    # Task goes into systemMessage (directive), context data goes into prompt
    child_params['systemMessage'] = task_description
    child_params['prompt'] = task_context if task_context else task_description

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
    logger.debug(f"[Delegated Agent] Context: {len(nodes)} nodes, {len(edges)} edges, "
                 f"edge_targets={set(e.get('target') for e in edges)}")

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

            # Check if child agent actually succeeded
            if not result.get('success'):
                # Child agent returned failure - treat as error
                error_msg = result.get('error', 'Child agent returned failure')
                logger.warning(f"[Delegated Agent] Task {task_id} returned success=False: {error_msg}")

                await broadcaster.update_node_status(
                    node_id,
                    "error",
                    {
                        "phase": "delegated_error",
                        "task_id": task_id,
                        "error": error_msg
                    },
                    workflow_id=workflow_id
                )

                # Cache error for parent retrieval
                _delegation_results[task_id] = {
                    "task_id": task_id,
                    "status": "error",
                    "agent_name": agent_label,
                    "agent_node_id": node_id,
                    "result": None,
                    "error": error_msg,
                }

                # Persist error to DB
                if database:
                    await database.save_node_output(
                        node_id=node_id,
                        session_id=f"delegation_{task_id}",
                        output_name="delegation_result",
                        data={
                            "task_id": task_id,
                            "parent_node_id": config.get('parent_node_id', ''),
                            "agent_name": agent_label,
                            "status": "error",
                            "error": error_msg,
                        }
                    )

                # Dispatch error event for trigger nodes
                await broadcaster.send_custom_event('task_completed', {
                    'task_id': task_id,
                    'status': 'error',
                    'agent_name': agent_label,
                    'agent_node_id': node_id,
                    'parent_node_id': config.get('parent_node_id', ''),
                    'error': error_msg,
                    'workflow_id': workflow_id,
                })

                return result

            # Success case - extract response properly
            response_text = result.get('result', {}).get('response', '')
            if not response_text:
                # Fallback: try to stringify the result dict
                response_text = str(result.get('result', '')) if result.get('result') else 'No response generated'

            # Broadcast completion
            response_preview = response_text[:200] if response_text else ''
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

            # Cache result for parent retrieval (Layer 2: in-memory)
            _delegation_results[task_id] = {
                "task_id": task_id,
                "status": "completed",
                "agent_name": agent_label,
                "agent_node_id": node_id,
                "result": response_text,
                "error": None,
            }

            # Persist to DB (Layer 3: cross-restart via existing NodeOutput)
            if database:
                await database.save_node_output(
                    node_id=node_id,
                    session_id=f"delegation_{task_id}",
                    output_name="delegation_result",
                    data={
                        "task_id": task_id,
                        "parent_node_id": config.get('parent_node_id', ''),
                        "agent_name": agent_label,
                        "status": "completed",
                        "result": response_text,
                    }
                )

            # Dispatch task_completed event for trigger nodes
            await broadcaster.send_custom_event('task_completed', {
                'task_id': task_id,
                'status': 'completed',
                'agent_name': agent_label,
                'agent_node_id': node_id,
                'parent_node_id': config.get('parent_node_id', ''),
                'result': response_text,
                'workflow_id': workflow_id,
            })

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

            # Cache error for parent retrieval (Layer 2: in-memory)
            _delegation_results[task_id] = {
                "task_id": task_id,
                "status": "error",
                "agent_name": agent_label,
                "agent_node_id": node_id,
                "result": None,
                "error": str(e),
            }

            # Persist to DB (Layer 3: cross-restart)
            if database:
                await database.save_node_output(
                    node_id=node_id,
                    session_id=f"delegation_{task_id}",
                    output_name="delegation_result",
                    data={
                        "task_id": task_id,
                        "parent_node_id": config.get('parent_node_id', ''),
                        "agent_name": agent_label,
                        "status": "error",
                        "error": str(e),
                    }
                )

            # Dispatch task_completed event for trigger nodes (error case)
            await broadcaster.send_custom_event('task_completed', {
                'task_id': task_id,
                'status': 'error',
                'agent_name': agent_label,
                'agent_node_id': node_id,
                'parent_node_id': config.get('parent_node_id', ''),
                'error': str(e),
                'workflow_id': workflow_id,
            })

            return {"success": False, "error": str(e)}

        finally:
            # Cleanup task reference
            _delegated_tasks.pop(task_id, None)
            # Cleanup delegation tracking (allows re-delegation after completion)
            _active_delegations.pop(delegation_key, None)

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
        "message": (
            f"SUCCESS: Task delegated to '{agent_label}' (task_id: {task_id}). "
            f"Agent is now working INDEPENDENTLY in the background. "
            f"IMPORTANT: Delegation is COMPLETE. Do NOT call this tool again for this task. "
            f"To check results later, use 'check_delegated_tasks' with task_id='{task_id}'."
        ),
    }


async def get_delegated_task_status(task_ids: Optional[List[str]] = None,
                                     database=None) -> Dict[str, Any]:
    """Check status and retrieve results of delegated tasks.

    3-layer lookup: live tasks -> memory cache -> DB (NodeOutput).
    Follows Celery AsyncResult / Ray ObjectRef pattern.

    Args:
        task_ids: Optional list of specific task IDs to check. If None, returns all known tasks.
        database: Database instance for Layer 3 (SQLite) lookup.

    Returns:
        Dict with 'tasks' list containing status and results for each task.
    """
    if not task_ids:
        # Return all known from memory
        task_ids = list(set(
            list(_delegated_tasks.keys()) + list(_delegation_results.keys())
        ))

    tasks = []
    db_lookup_ids = []

    for tid in task_ids:
        # Layer 1: Live asyncio.Task (still running or just finished)
        live_task = _delegated_tasks.get(tid)
        if live_task is not None:
            if not live_task.done():
                tasks.append({"task_id": tid, "status": "running"})
            else:
                # Task finished -- extract result via task.result()
                try:
                    result = live_task.result()
                    response = result.get('result', {}).get('response', str(result.get('result', '')))
                    tasks.append({"task_id": tid, "status": "completed", "result": response})
                except Exception as e:
                    tasks.append({"task_id": tid, "status": "error", "error": str(e)})
            continue

        # Layer 2: In-memory result cache
        cached = _delegation_results.get(tid)
        if cached:
            tasks.append(cached)
            continue

        # Layer 3: Need DB lookup
        db_lookup_ids.append(tid)

    # DB fallback for results not in memory (cross-restart)
    if db_lookup_ids and database:
        for tid in list(db_lookup_ids):
            db_result = await database.get_node_output_by_session(
                session_id=f"delegation_{tid}",
                output_name="delegation_result"
            )
            if db_result:
                data = db_result.get('data', {})
                result_data = data.get("result", {})
                response_text = result_data.get("response", str(result_data)) if isinstance(result_data, dict) else str(result_data)
                tasks.append({
                    "task_id": tid,
                    "status": data.get("status", "completed"),
                    "agent_name": data.get("agent_name", ""),
                    "result": response_text,
                    "error": data.get("error"),
                })
                db_lookup_ids.remove(tid)

    # Remaining IDs not found anywhere
    for tid in db_lookup_ids:
        tasks.append({"task_id": tid, "status": "not_found"})

    return {"tasks": tasks}


async def _execute_check_delegated_tasks(args: Dict[str, Any],
                                          config: Dict[str, Any]) -> Dict[str, Any]:
    """LLM-callable tool: check on delegated child agents.

    Returns status and results for previously delegated tasks.
    Follows Celery AsyncResult / Ray ObjectRef patterns.
    """
    task_ids = args.get('task_ids')
    database = config.get('database')
    result = await get_delegated_task_status(task_ids=task_ids, database=database)

    formatted = []
    for task in result.get("tasks", []):
        entry = {
            "task_id": task.get("task_id"),
            "status": task.get("status"),
            "agent_name": task.get("agent_name"),
        }
        if task.get("status") == "completed":
            text = str(task.get("result", ""))
            entry["result"] = text[:4000] + "... [truncated]" if len(text) > 4000 else text
        elif task.get("status") == "error":
            entry["error"] = task.get("error")
        elif task.get("status") == "running":
            entry["message"] = f"Agent '{task.get('agent_name', 'unknown')}' is still working"
        formatted.append(entry)

    return {
        "total_tasks": len(formatted),
        "completed": sum(1 for t in formatted if t.get("status") == "completed"),
        "running": sum(1 for t in formatted if t.get("status") == "running"),
        "errors": sum(1 for t in formatted if t.get("status") == "error"),
        "tasks": formatted,
    }


async def _execute_task_manager(
    tool_args: Dict[str, Any],
    config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute task manager operations.

    Dual-purpose: works as AI tool (LLM fills args) or workflow node (uses params).

    Operations:
    - list_tasks: List all active and completed delegated tasks
    - get_task: Get status details for a specific task
    - mark_done: Remove a task from active tracking

    Args:
        tool_args: Arguments from LLM tool call (operation, task_id, status_filter)
        config: Tool configuration with node parameters

    Returns:
        Dict with operation results
    """
    # Merge tool_args with node parameters (tool_args takes precedence)
    params = config.get('parameters', {})
    operation = tool_args.get('operation') or params.get('operation', 'list_tasks')
    task_id = tool_args.get('task_id') or params.get('task_id')
    status_filter = tool_args.get('status_filter') or params.get('status_filter')
    database = config.get('database')

    logger.debug(f"[TaskManager] Operation: {operation}, task_id: {task_id}, filter: {status_filter}")

    if operation == 'list_tasks':
        # Collect all tasks from _delegated_tasks and _delegation_results
        tasks = []

        # Active tasks from asyncio.Task tracking
        for tid, task in _delegated_tasks.items():
            if task.done():
                try:
                    if task.cancelled():
                        status = 'cancelled'
                    elif task.exception():
                        status = 'error'
                    else:
                        status = 'completed'
                except Exception:
                    status = 'completed'
            else:
                status = 'running'

            tasks.append({
                'task_id': tid,
                'status': status,
                'active': True
            })

        # Completed tasks from in-memory cache
        for tid, result in _delegation_results.items():
            if tid not in [t['task_id'] for t in tasks]:
                tasks.append({
                    'task_id': tid,
                    'status': result.get('status', 'completed'),
                    'agent_name': result.get('agent_name'),
                    'result_summary': str(result.get('result', ''))[:200],
                    'active': False
                })

        # Apply status filter
        if status_filter:
            tasks = [t for t in tasks if t.get('status') == status_filter]

        return {
            'success': True,
            'operation': 'list_tasks',
            'tasks': tasks,
            'count': len(tasks),
            'running': sum(1 for t in tasks if t.get('status') == 'running'),
            'completed': sum(1 for t in tasks if t.get('status') == 'completed'),
            'errors': sum(1 for t in tasks if t.get('status') == 'error')
        }

    elif operation == 'get_task':
        if not task_id:
            return {'success': False, 'error': 'task_id is required for get_task operation'}

        # Use existing get_delegated_task_status for detailed lookup
        result = await get_delegated_task_status(task_ids=[task_id], database=database)
        tasks = result.get('tasks', [])

        if not tasks:
            return {
                'success': False,
                'error': f'Task {task_id} not found',
                'task_id': task_id
            }

        task_info = tasks[0]
        return {
            'success': True,
            'operation': 'get_task',
            'task_id': task_id,
            'status': task_info.get('status'),
            'agent_name': task_info.get('agent_name'),
            'result': task_info.get('result'),
            'error': task_info.get('error')
        }

    elif operation == 'mark_done':
        if not task_id:
            return {'success': False, 'error': 'task_id is required for mark_done operation'}

        # Remove from active tracking
        removed = False
        if task_id in _delegated_tasks:
            del _delegated_tasks[task_id]
            removed = True
        if task_id in _delegation_results:
            del _delegation_results[task_id]
            removed = True

        return {
            'success': True,
            'operation': 'mark_done',
            'task_id': task_id,
            'removed': removed,
            'message': f'Task {task_id} marked as done and removed from tracking' if removed else f'Task {task_id} was not in active tracking'
        }

    return {'success': False, 'error': f'Unknown operation: {operation}'}


async def handle_task_manager(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle taskManager as workflow node.

    Wrapper for _execute_task_manager that conforms to the standard
    workflow node handler signature.

    Args:
        node_id: The node ID
        node_type: Should be 'taskManager'
        parameters: Node parameters (operation, task_id, status_filter)
        context: Execution context

    Returns:
        Task manager operation results
    """
    config = {
        'parameters': parameters,
        'database': context.get('database')
    }
    return await _execute_task_manager({}, config)


# =============================================================================
# SEARCH TOOL WRAPPERS (for AI Agent tool calling)
# =============================================================================

async def _execute_brave_search_tool(args: Dict[str, Any],
                                     node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Brave Search via handler (AI Agent tool wrapper)."""
    from services.handlers.search import handle_brave_search

    parameters = {**node_params, **args}
    return await handle_brave_search(
        node_id="tool_brave_search",
        node_type="braveSearch",
        parameters=parameters,
        context={}
    )


async def _execute_serper_search_tool(args: Dict[str, Any],
                                      node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Serper Search via handler (AI Agent tool wrapper)."""
    from services.handlers.search import handle_serper_search

    parameters = {**node_params, **args}
    return await handle_serper_search(
        node_id="tool_serper_search",
        node_type="serperSearch",
        parameters=parameters,
        context={}
    )


async def _execute_perplexity_search_tool(args: Dict[str, Any],
                                          node_params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Perplexity Search via handler (AI Agent tool wrapper)."""
    from services.handlers.search import handle_perplexity_search

    parameters = {**node_params, **args}
    return await handle_perplexity_search(
        node_id="tool_perplexity_search",
        node_type="perplexitySearch",
        parameters=parameters,
        context={}
    )
