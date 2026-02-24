"""Node Executor - Single node execution with handler dispatch.

Uses a registry pattern for clean handler dispatch without if-else chains.
"""

import asyncio
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Dict, Any, Optional, Callable, TYPE_CHECKING

from core.logging import get_logger
from constants import (
    ANDROID_SERVICE_NODE_TYPES,
    AI_MODEL_TYPES,
    AI_CHAT_MODEL_TYPES,
    GOOGLE_MAPS_TYPES,
    detect_ai_provider,
)
from models.nodes import validate_node_params
from pydantic import ValidationError
from services import event_waiter
from services.handlers import (
    handle_ai_agent, handle_chat_agent, handle_ai_chat_model, handle_simple_memory,
    handle_android_service,
    handle_python_executor, handle_javascript_executor, handle_typescript_executor,
    handle_http_request, handle_webhook_response, handle_trigger_node,
    handle_create_map, handle_add_locations, handle_nearby_places,
    handle_text_generator, handle_file_handler,
    handle_chat_send, handle_chat_history,
    handle_start, handle_cron_scheduler, handle_timer, handle_console, handle_team_monitor,
    handle_whatsapp_send, handle_whatsapp_db,
    handle_social_receive, handle_social_send,
    handle_http_scraper, handle_file_downloader, handle_document_parser,
    handle_text_chunker, handle_embedding_generator, handle_vector_store,
    handle_task_manager,
    handle_twitter_send, handle_twitter_search, handle_twitter_user,
    handle_gmail_send, handle_gmail_search, handle_gmail_read,
    handle_brave_search, handle_serper_search, handle_perplexity_search,
)
from services.handlers.apify import handle_apify_actor
from services.handlers.calendar import (
    handle_calendar_create, handle_calendar_list, handle_calendar_update, handle_calendar_delete,
)
from services.handlers.drive import (
    handle_drive_upload, handle_drive_download, handle_drive_list, handle_drive_share,
)
from services.handlers.sheets import (
    handle_sheets_read, handle_sheets_write, handle_sheets_append,
)
from services.handlers.tasks import (
    handle_tasks_create, handle_tasks_list, handle_tasks_complete, handle_tasks_update, handle_tasks_delete,
)
from services.handlers.contacts import (
    handle_contacts_create, handle_contacts_list, handle_contacts_search,
    handle_contacts_get, handle_contacts_update, handle_contacts_delete,
)

if TYPE_CHECKING:
    from core.config import Settings
    from core.database import Database
    from services.ai import AIService
    from services.maps import MapsService
    from services.text import TextService
    from services.android_service import AndroidService

logger = get_logger(__name__)


@dataclass
class ExecutionResult:
    """Standardized execution result."""
    success: bool
    node_id: str
    node_type: str
    result: Optional[Dict] = None
    error: Optional[str] = None
    execution_id: str = ""
    execution_time: float = 0.0
    timestamp: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "success": self.success,
            "node_id": self.node_id,
            "node_type": self.node_type,
            "execution_id": self.execution_id,
            "execution_time": self.execution_time,
            "timestamp": self.timestamp or datetime.now().isoformat(),
        }
        if self.success:
            d["result"] = self.result or {}
        else:
            d["error"] = self.error
        return d


class NodeExecutor:
    """Executes individual workflow nodes using registry-based dispatch."""

    def __init__(
        self,
        database: "Database",
        ai_service: "AIService",
        maps_service: "MapsService",
        text_service: "TextService",
        android_service: "AndroidService",
        settings: "Settings",
        output_store: Optional[Callable] = None,
    ):
        self.database = database
        self.ai_service = ai_service
        self.maps_service = maps_service
        self.text_service = text_service
        self.android_service = android_service
        self.settings = settings
        self._output_store = output_store
        self._handlers = self._build_handler_registry()

    def _build_handler_registry(self) -> Dict[str, Callable]:
        """Build handler registry with service dependencies bound via partial."""
        registry = {
            # Workflow control
            'start': handle_start,
            'cronScheduler': handle_cron_scheduler,
            'timer': handle_timer,
            # AI
            'aiAgent': partial(handle_ai_agent, ai_service=self.ai_service, database=self.database),
            'chatAgent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            # Specialized Agents (use chatAgent handler - same skill/memory/tools architecture)
            'android_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'coding_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'web_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'task_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'social_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'travel_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'tool_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'productivity_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'payments_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'consumer_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'autonomous_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'orchestrator_agent': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'ai_employee': partial(handle_chat_agent, ai_service=self.ai_service, database=self.database),
            'simpleMemory': handle_simple_memory,
            # Maps
            'gmaps_create': partial(handle_create_map, maps_service=self.maps_service),
            'gmaps_locations': partial(handle_add_locations, maps_service=self.maps_service),
            'gmaps_nearby_places': partial(handle_nearby_places, maps_service=self.maps_service),
            # Text
            'textGenerator': partial(handle_text_generator, text_service=self.text_service),
            'fileHandler': partial(handle_file_handler, text_service=self.text_service),
            # WhatsApp
            'whatsappSend': handle_whatsapp_send,
            'whatsappDb': handle_whatsapp_db,
            # Twitter/X
            'twitterSend': handle_twitter_send,
            'twitterSearch': handle_twitter_search,
            'twitterUser': handle_twitter_user,
            # Gmail
            'gmailSend': handle_gmail_send,
            'gmailSearch': handle_gmail_search,
            'gmailRead': handle_gmail_read,
            # Google Calendar
            'calendarCreate': handle_calendar_create,
            'calendarList': handle_calendar_list,
            'calendarUpdate': handle_calendar_update,
            'calendarDelete': handle_calendar_delete,
            # Google Drive
            'driveUpload': handle_drive_upload,
            'driveDownload': handle_drive_download,
            'driveList': handle_drive_list,
            'driveShare': handle_drive_share,
            # Google Sheets
            'sheetsRead': handle_sheets_read,
            'sheetsWrite': handle_sheets_write,
            'sheetsAppend': handle_sheets_append,
            # Google Tasks
            'tasksCreate': handle_tasks_create,
            'tasksList': handle_tasks_list,
            'tasksComplete': handle_tasks_complete,
            'tasksUpdate': handle_tasks_update,
            'tasksDelete': handle_tasks_delete,
            # Google Contacts (People API)
            'contactsCreate': handle_contacts_create,
            'contactsList': handle_contacts_list,
            'contactsSearch': handle_contacts_search,
            'contactsGet': handle_contacts_get,
            'contactsUpdate': handle_contacts_update,
            'contactsDelete': handle_contacts_delete,
            # Search
            'braveSearch': handle_brave_search,
            'serperSearch': handle_serper_search,
            'perplexitySearch': handle_perplexity_search,
            # Social (unified messaging)
            # Note: socialReceive handled in _dispatch with connected_outputs
            'socialSend': handle_social_send,
            # Chat
            'chatSend': handle_chat_send,
            'chatHistory': handle_chat_history,
            # HTTP
            'httpRequest': handle_http_request,
            # Document processing
            'httpScraper': handle_http_scraper,
            'fileDownloader': handle_file_downloader,
            'documentParser': handle_document_parser,
            'textChunker': handle_text_chunker,
            'embeddingGenerator': handle_embedding_generator,
            'vectorStore': handle_vector_store,
            # Task management
            'taskManager': handle_task_manager,
            # Team monitoring
            'teamMonitor': handle_team_monitor,
            # Apify web scraping
            'apifyActor': handle_apify_actor,
            # Note: 'console' handled in _dispatch with connected_outputs
        }

        # Register AI chat models
        for node_type in AI_CHAT_MODEL_TYPES:
            registry[node_type] = partial(handle_ai_chat_model, ai_service=self.ai_service)

        # Register Android services
        for node_type in ANDROID_SERVICE_NODE_TYPES:
            registry[node_type] = partial(handle_android_service, android_service=self.android_service)

        return registry

    async def execute(
        self,
        node_id: str,
        node_type: str,
        parameters: Dict[str, Any],
        context: Dict[str, Any],
        resolve_params_fn: Optional[Callable] = None,
    ) -> Dict[str, Any]:
        """Execute a single workflow node."""
        start_time = time.time()
        session_id = context.get('session_id', 'default')
        execution_id = context.get('execution_id') or str(uuid.uuid4())[:8]

        try:
            # Load, validate, enhance parameters
            params = await self._prepare_parameters(node_id, node_type, parameters, session_id)

            # Resolve templates if resolver provided
            nodes = context.get('nodes')
            edges = context.get('edges')
            logger.debug(f"[NodeExecutor] Template resolution check: resolve_fn={resolve_params_fn is not None}, nodes={len(nodes) if nodes else 'None'}, edges={len(edges) if edges else 'None'}")

            if resolve_params_fn and nodes is not None and edges is not None:
                logger.debug(f"[NodeExecutor] Before resolution: params={list(params.keys())}")
                params = await resolve_params_fn(params, node_id, nodes, edges, session_id)
                logger.debug(f"[NodeExecutor] After resolution: params keys={list(params.keys())}")

            # Build handler context
            handler_ctx = {
                **context,
                "start_time": start_time,
                "execution_id": execution_id,
            }
            logger.info("NodeExecutor context", node_id=node_id, workflow_id=context.get('workflow_id'))

            # Execute via registry or special handlers
            result = await self._dispatch(node_id, node_type, params, handler_ctx)
            result['execution_id'] = execution_id

            # Store output if successful
            if result.get('success') and self._output_store:
                output_data = result.get('result', {})

                # For Android service nodes, extract the nested 'data' field for cleaner template access
                # This allows {{batterymonitor.battery_level}} instead of {{batterymonitor.data.battery_level}}
                if node_type in ANDROID_SERVICE_NODE_TYPES and isinstance(output_data, dict):
                    # Flatten: promote 'data' contents to top level while preserving metadata
                    nested_data = output_data.get('data', {})
                    if isinstance(nested_data, dict):
                        # Merge nested data with metadata (service_id, action, timestamp, etc.)
                        output_data = {**output_data, **nested_data}
                        logger.debug(f"[NodeExecutor] Flattened Android output for {node_id}: keys={list(output_data.keys())}")

                # For socialReceive, store 4 outputs for different handle connections
                # - output_message: Text for LLM input
                # - output_media: Media data
                # - output_contact: Sender/contact info
                # - output_metadata: Message metadata
                if node_type == 'socialReceive' and isinstance(output_data, dict):
                    await self._output_store(session_id, node_id, "output_message", output_data.get('message', ''))
                    await self._output_store(session_id, node_id, "output_media", output_data.get('media', {}))
                    await self._output_store(session_id, node_id, "output_contact", output_data.get('contact', {}))
                    await self._output_store(session_id, node_id, "output_metadata", output_data.get('metadata', {}))

                # Store with multiple keys for different handle IDs used by frontend components:
                # - output_main: SquareNode, GenericNode, TriggerNode, StartNode
                # - output_top: AIAgentNode (agents use top output handle)
                # - output_0: backward compatibility
                await self._output_store(session_id, node_id, "output_main", output_data)
                await self._output_store(session_id, node_id, "output_top", output_data)
                await self._output_store(session_id, node_id, "output_0", output_data)

            return result

        except asyncio.CancelledError:
            return ExecutionResult(False, node_id, node_type, error="Cancelled",
                                   execution_id=execution_id, execution_time=time.time()-start_time).to_dict()
        except Exception as e:
            logger.error("Node execution error", node_id=node_id, error=str(e))
            return ExecutionResult(False, node_id, node_type, error=str(e),
                                   execution_id=execution_id, execution_time=time.time()-start_time).to_dict()

    async def _prepare_parameters(self, node_id: str, node_type: str, params: Dict, session_id: str) -> Dict:
        """Load from DB, validate, inject API keys."""
        # Merge with DB parameters (DB provides defaults, frontend can override)
        db_params = await self.database.get_node_parameters(node_id) or {}
        merged = {**db_params, **params} if params else db_params

        # Validate
        try:
            validated = validate_node_params(node_type, merged)
            merged = {**merged, **validated.model_dump(by_alias=True, exclude_unset=True)}
        except ValidationError as e:
            logger.warning("Validation warning", node_type=node_type, errors=str(e))

        # Inject API keys
        return await self._inject_api_keys(node_type, merged)

    async def _inject_api_keys(self, node_type: str, params: Dict) -> Dict:
        """Auto-inject API keys for AI and Maps nodes."""
        result = params.copy()

        if node_type in AI_MODEL_TYPES:
            provider = detect_ai_provider(node_type, params)
            if not result.get('api_key') and not result.get('apiKey'):
                key = await self.ai_service.auth.get_api_key(provider, "default")
                if key:
                    result['api_key'] = key
            if not result.get('model'):
                models = await self.ai_service.auth.get_stored_models(provider, "default")
                if models:
                    result['model'] = models[0]

        elif node_type in GOOGLE_MAPS_TYPES:
            if not result.get('api_key'):
                # Try database first, then fall back to environment variable
                key = await self.ai_service.auth.get_api_key("google_maps", "default")
                if key:
                    result['api_key'] = key
                elif self.settings.google_maps_api_key:
                    result['api_key'] = self.settings.google_maps_api_key

        return result

    async def _dispatch(self, node_id: str, node_type: str, params: Dict, context: Dict) -> Dict:
        """Dispatch to handler from registry or special handlers."""

        # Check registry first
        handler = self._handlers.get(node_type)
        if handler:
            return await handler(node_id, node_type, params, context)

        # Special handlers needing connected outputs
        if node_type in ('pythonExecutor', 'javascriptExecutor', 'typescriptExecutor', 'webhookResponse', 'console', 'socialReceive'):
            logger.debug(f"[_dispatch] Getting connected outputs for {node_type} node_id={node_id}")
            outputs, source_nodes = await self._get_connected_outputs_with_info(context, node_id)
            logger.debug(f"[_dispatch] Got {len(outputs)} outputs for {node_type}: keys={list(outputs.keys())}")
            if node_type == 'console':
                return await handle_console(node_id, node_type, params, context, outputs, source_nodes)
            if node_type == 'socialReceive':
                return await handle_social_receive(node_id, node_type, params, context, outputs, source_nodes)
            handlers = {
                'pythonExecutor': handle_python_executor,
                'javascriptExecutor': handle_javascript_executor,
                'typescriptExecutor': handle_typescript_executor,
                'webhookResponse': handle_webhook_response,
            }
            return await handlers[node_type](node_id, node_type, params, context, outputs)

        # Trigger nodes
        if event_waiter.is_trigger_node(node_type):
            return await handle_trigger_node(node_id, node_type, params, context)

        # Fallback
        return {
            "success": True,
            "node_id": node_id,
            "node_type": node_type,
            "result": {"message": f"Node {node_id} executed", "parameters": params},
            "execution_time": time.time() - context.get('start_time', time.time()),
            "timestamp": datetime.now().isoformat()
        }

    async def _get_connected_outputs(self, context: Dict, node_id: str) -> Dict[str, Any]:
        """Get outputs from connected upstream nodes with handle-aware routing."""
        get_output = context.get('get_output_fn')
        if not get_output:
            return {}

        nodes = context.get('nodes', [])
        edges = context.get('edges', [])
        session_id = context.get('session_id', 'default')
        result = {}

        for edge in edges:
            if edge.get('target') == node_id:
                source_id = edge.get('source')
                source_handle = edge.get('sourceHandle')

                # Map sourceHandle to output key
                if source_handle and source_handle.startswith('output-'):
                    handle_name = source_handle.replace('output-', '')
                    output_key = f"output_{handle_name}"
                else:
                    output_key = "output_0"

                output = await get_output(session_id, source_id, output_key)

                # Fallback to output_0 if specific handle output not found
                if output is None and output_key != "output_0":
                    output = await get_output(session_id, source_id, "output_0")

                if output:
                    source = next((n for n in nodes if n.get('id') == source_id), {})
                    result[source.get('type', 'unknown')] = output

        return result

    def _get_source_nodes_info(self, context: Dict, node_id: str) -> list:
        """Get source node info (id, type, label) for edges targeting this node.

        This is used for display purposes (e.g., showing source in Console panel).
        Does NOT filter by output availability - just returns edge source info.
        """
        nodes = context.get('nodes', [])
        edges = context.get('edges', [])
        source_nodes = []

        for edge in edges:
            if edge.get('target') == node_id:
                source_id = edge.get('source')
                source = next((n for n in nodes if n.get('id') == source_id), {})
                source_type = source.get('type', 'unknown')
                source_data = source.get('data', {})
                source_label = source_data.get('label') or source_type
                source_nodes.append({
                    'id': source_id,
                    'type': source_type,
                    'label': source_label
                })

        return source_nodes

    async def _get_connected_outputs_with_info(self, context: Dict, node_id: str) -> tuple:
        """Get outputs from connected upstream nodes with source node info.

        Returns:
            Tuple of (outputs dict, source_nodes list with id/type/label info)
        """
        get_output = context.get('get_output_fn')
        if not get_output:
            logger.warning(f"[_get_connected_outputs_with_info] No get_output_fn in context for {node_id}")
            return {}, []

        nodes = context.get('nodes', [])
        edges = context.get('edges', [])
        session_id = context.get('session_id', 'default')
        outputs = {}
        source_nodes = []

        logger.info(f"[_get_connected_outputs_with_info] node_id={node_id}, edges={len(edges)}, session={session_id}")

        for edge in edges:
            logger.debug(f"[_get_connected_outputs_with_info] Checking edge: source={edge.get('source')}, target={edge.get('target')}, sourceHandle={edge.get('sourceHandle')}, targetHandle={edge.get('targetHandle')}")
            if edge.get('target') == node_id:
                source_id = edge.get('source')
                source_handle = edge.get('sourceHandle')

                # Map sourceHandle to output key
                # Frontend uses "output-<name>", backend stores as "output_<name>"
                if source_handle and source_handle.startswith('output-'):
                    handle_name = source_handle.replace('output-', '')
                    output_key = f"output_{handle_name}"
                else:
                    output_key = "output_0"

                logger.info(f"[_get_connected_outputs_with_info] Found edge from {source_id} to {node_id}, sourceHandle={source_handle}, using output_key={output_key}")
                output = await get_output(session_id, source_id, output_key)
                logger.info(f"[_get_connected_outputs_with_info] First lookup (key={output_key}): {'FOUND' if output else 'NOT_FOUND'}")

                # Fallback to output_0 if specific handle output not found
                if output is None and output_key != "output_0":
                    logger.info(f"[_get_connected_outputs_with_info] output_key {output_key} not found, falling back to output_0")
                    output = await get_output(session_id, source_id, "output_0")
                    logger.info(f"[_get_connected_outputs_with_info] Fallback lookup (output_0): {'FOUND' if output else 'NOT_FOUND'}")

                logger.info(f"[_get_connected_outputs_with_info] Final output from {source_id}: {'FOUND' if output else 'NOT FOUND'}")
                if output:
                    source = next((n for n in nodes if n.get('id') == source_id), {})
                    source_type = source.get('type', 'unknown')
                    outputs[source_type] = output
                    # Get label from node data if available
                    source_data = source.get('data', {})
                    source_label = source_data.get('label') or source_type
                    source_nodes.append({
                        'id': source_id,
                        'type': source_type,
                        'label': source_label
                    })

        logger.debug(f"[_get_connected_outputs_with_info] Returning {len(outputs)} outputs, {len(source_nodes)} source_nodes")
        return outputs, source_nodes
