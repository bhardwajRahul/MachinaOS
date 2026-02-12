"""WebSocket router for real-time bidirectional communication.

Handles WebSocket connections from frontend clients for ALL operations:
- Node parameters (get, save, delete)
- Node execution
- AI execution and model fetching
- API key validation and storage
- Android device operations
- Google Maps key validation
- Status broadcasts
"""

import time
import asyncio
import weakref
from typing import Dict, Any, Callable, Awaitable, Optional, Set
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.status_broadcaster import get_status_broadcaster
from core.container import container
from core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["websocket"])

# =============================================================================
# Concurrent Send Protection
# =============================================================================
# Use WeakKeyDictionary to auto-cleanup when WebSocket is garbage collected
_send_locks: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()

# Track running handler tasks per WebSocket for cleanup on disconnect
_handler_tasks: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()


async def _safe_send(websocket: WebSocket, data: dict):
    """Thread-safe WebSocket send with lock to prevent concurrent writes."""
    if websocket not in _send_locks:
        _send_locks[websocket] = asyncio.Lock()
    async with _send_locks[websocket]:
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.error(f"[WebSocket] Send error: {e}")


# Type for message handlers
MessageHandler = Callable[[Dict[str, Any], WebSocket], Awaitable[Dict[str, Any]]]


def ws_handler(*required_fields: str):
    """Simple decorator for WebSocket handlers. Validates required fields and wraps errors."""
    def decorator(func: MessageHandler) -> MessageHandler:
        async def wrapper(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
            for field in required_fields:
                if not data.get(field):
                    return {"success": False, "error": f"{field} required"}
            try:
                result = await func(data, websocket)
                if "success" not in result:
                    result = {"success": True, **result}
                return result
            except Exception as e:
                logger.error(f"Handler error: {e}", exc_info=True)
                return {"success": False, "error": str(e)}
        return wrapper
    return decorator


# ============================================================================
# Message Handlers
# ============================================================================

async def handle_ping(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Handle ping request."""
    return {"type": "pong", "timestamp": time.time()}


async def handle_get_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get current full status."""
    broadcaster = get_status_broadcaster()
    return {"type": "full_status", "data": broadcaster.get_status()}


async def handle_get_android_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get Android connection status."""
    broadcaster = get_status_broadcaster()
    return {"type": "android_status", "data": broadcaster.get_android_status()}


async def handle_get_node_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get specific node status."""
    broadcaster = get_status_broadcaster()
    node_id = data.get("node_id")
    if node_id:
        status = broadcaster.get_node_status(node_id)
        return {"type": "node_status", "node_id": node_id, "data": status}
    return {"type": "error", "message": "node_id required"}


async def handle_get_variable(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get variable value."""
    broadcaster = get_status_broadcaster()
    name = data.get("name")
    if name:
        value = broadcaster.get_variable(name)
        return {"type": "variable_update", "name": name, "value": value}
    return {"type": "error", "message": "name required"}


# ============================================================================
# Node Parameters Handlers
# ============================================================================

@ws_handler("node_id")
async def handle_get_node_parameters(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get parameters for a specific node."""
    database = container.database()
    node_id = data["node_id"]
    parameters = await database.get_node_parameters(node_id)
    logger.debug(f"[GET_PARAMS] Node ID: {node_id}")
    logger.debug(f"[GET_PARAMS] Raw from DB: {parameters}")
    logger.debug(f"[GET_PARAMS] Code length: {len(parameters.get('code', '')) if parameters and 'code' in parameters else 'no code field'}")
    return {"node_id": node_id, "parameters": parameters or {}, "version": 1, "timestamp": time.time()}


@ws_handler()
async def handle_get_all_node_parameters(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get parameters for multiple nodes."""
    database = container.database()
    result = {}
    for node_id in data.get("node_ids", []):
        parameters = await database.get_node_parameters(node_id)
        if parameters:
            result[node_id] = {"parameters": parameters, "version": 1}
    return {"parameters": result, "timestamp": time.time()}


@ws_handler("node_id")
async def handle_save_node_parameters(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Save node parameters and broadcast to all clients."""
    database = container.database()
    broadcaster = get_status_broadcaster()
    node_id, parameters = data["node_id"], data.get("parameters", {})

    logger.debug(f"[SAVE_PARAMS] Node ID: {node_id}, has_code: {'code' in parameters}, code_len: {len(parameters.get('code', '')) if 'code' in parameters else 0}")
    await database.save_node_parameters(node_id, parameters)
    await broadcaster.broadcast({
        "type": "node_parameters_updated", "node_id": node_id,
        "parameters": parameters, "version": 1, "timestamp": time.time()
    })
    return {"node_id": node_id, "parameters": parameters, "version": 1, "timestamp": time.time()}


@ws_handler("node_id")
async def handle_delete_node_parameters(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Delete node parameters."""
    database = container.database()
    await database.delete_node_parameters(data["node_id"])
    return {"node_id": data["node_id"]}


# ============================================================================
# Tool Schema Handlers (Source of truth for tool node configurations)
# ============================================================================

@ws_handler("node_id")
async def handle_get_tool_schema(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get tool schema for a node."""
    database = container.database()
    schema = await database.get_tool_schema(data["node_id"])
    return {"node_id": data["node_id"], "schema": schema}


@ws_handler("node_id", "tool_name", "tool_description", "schema_config")
async def handle_save_tool_schema(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Save tool schema for a node. Used by Android Toolkit to update connected service schemas."""
    database = container.database()
    broadcaster = get_status_broadcaster()

    node_id = data["node_id"]
    tool_name = data["tool_name"]
    tool_description = data["tool_description"]
    schema_config = data["schema_config"]
    connected_services = data.get("connected_services")

    success = await database.save_tool_schema(
        node_id=node_id,
        tool_name=tool_name,
        tool_description=tool_description,
        schema_config=schema_config,
        connected_services=connected_services
    )

    if success:
        # Broadcast schema update to all clients
        await broadcaster.broadcast({
            "type": "tool_schema_updated",
            "node_id": node_id,
            "tool_name": tool_name,
            "timestamp": time.time()
        })

    return {
        "node_id": node_id,
        "tool_name": tool_name,
        "saved": success
    }


@ws_handler("node_id")
async def handle_delete_tool_schema(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Delete tool schema for a node."""
    database = container.database()
    await database.delete_tool_schema(data["node_id"])
    return {"node_id": data["node_id"]}


async def handle_get_all_tool_schemas(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get all tool schemas."""
    database = container.database()
    schemas = await database.get_all_tool_schemas()
    return {"success": True, "schemas": schemas}


# ============================================================================
# Node Execution Handlers
# ============================================================================

@ws_handler("node_id", "node_type")
async def handle_execute_node(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Execute a workflow node with per-workflow status scoping (n8n pattern)."""
    workflow_service = container.workflow_service()
    broadcaster = get_status_broadcaster()
    node_id, node_type = data["node_id"], data["node_type"]
    workflow_id = data.get("workflow_id")  # Per-workflow isolation

    await broadcaster.update_node_status(node_id, "executing", workflow_id=workflow_id)
    result = await workflow_service.execute_node(
        node_id=node_id, node_type=node_type,
        parameters=data.get("parameters", {}),
        nodes=data.get("nodes", []), edges=data.get("edges", []),
        session_id=data.get("session_id", "default"),
        workflow_id=workflow_id,
        outputs=data.get("outputs", {}),  # Upstream node outputs for data flow
    )

    if result.get("success"):
        await broadcaster.update_node_status(node_id, "success", result.get("result"), workflow_id=workflow_id)
        await broadcaster.update_node_output(node_id, result.get("result"), workflow_id=workflow_id)
    elif result.get("error") == "Cancelled by user":
        # Cancelled trigger nodes go back to idle, not error
        await broadcaster.update_node_status(node_id, "idle", {"message": "Cancelled"}, workflow_id=workflow_id)
    else:
        await broadcaster.update_node_status(node_id, "error", {"error": result.get("error")}, workflow_id=workflow_id)

    # Explicitly pass through success status (don't let decorator default to True)
    ws_result = {
        "success": result.get("success", False),
        "node_id": node_id,
        "result": result.get("result"),
        "error": result.get("error"),
        "execution_time": result.get("execution_time"),
        "timestamp": time.time()
    }
    # Debug: Log what we're returning to WebSocket
    result_data = result.get("result")
    logger.debug(f"[WS execute_node] Returning: success={ws_result['success']}, result.response={repr(result_data.get('response', 'MISSING')[:100] if result_data and result_data.get('response') else 'None')}")
    return ws_result


@ws_handler("node_id")
async def handle_cancel_execution(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Cancel node execution."""
    broadcaster = get_status_broadcaster()
    await broadcaster.update_node_status(data["node_id"], "idle")
    return {"node_id": data["node_id"], "message": "Execution cancelled"}


@ws_handler()
async def handle_cancel_event_wait(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Cancel an active event waiter (for trigger nodes).

    Can cancel by waiter_id or node_id.
    Note: Status update to "idle" happens in handle_execute_node when it catches CancelledError.
    """
    from services import event_waiter

    waiter_id = data.get("waiter_id")
    node_id = data.get("node_id")

    logger.debug(f"[WebSocket] handle_cancel_event_wait called: waiter_id={waiter_id}, node_id={node_id}")

    if waiter_id:
        success = event_waiter.cancel(waiter_id)
        logger.debug(f"[WebSocket] cancel by waiter_id result: success={success}")
        return {"success": success, "waiter_id": waiter_id, "message": "Cancelled" if success else "Not found"}
    elif node_id:
        count = event_waiter.cancel_for_node(node_id)
        logger.debug(f"[WebSocket] cancel by node_id result: cancelled_count={count}")
        return {"success": count > 0, "node_id": node_id, "cancelled_count": count}
    else:
        return {"success": False, "error": "waiter_id or node_id required"}


@ws_handler()
async def handle_get_active_waiters(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get list of active event waiters (for debugging/UI)."""
    from services import event_waiter
    return {"waiters": event_waiter.get_active_waiters()}


# ============================================================================
# Dead Letter Queue (DLQ) Handlers
# ============================================================================

@ws_handler()
async def handle_get_dlq_entries(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get DLQ entries with optional filtering.

    Optional params:
        workflow_id: Filter by workflow ID
        node_type: Filter by node type
        limit: Max entries to return (default 100)

    Returns:
        List of DLQ entries
    """
    from services.execution import ExecutionCache
    cache_service = container.cache()
    execution_cache = ExecutionCache(cache_service)

    entries = await execution_cache.get_dlq_entries(
        workflow_id=data.get("workflow_id"),
        node_type=data.get("node_type"),
        limit=data.get("limit", 100)
    )

    return {
        "entries": [entry.to_dict() for entry in entries],
        "count": len(entries),
        "timestamp": time.time()
    }


@ws_handler("entry_id")
async def handle_get_dlq_entry(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get a single DLQ entry by ID.

    Required:
        entry_id: DLQ entry ID

    Returns:
        DLQ entry details
    """
    from services.execution import ExecutionCache
    cache_service = container.cache()
    execution_cache = ExecutionCache(cache_service)

    entry = await execution_cache.get_dlq_entry(data["entry_id"])

    if entry:
        return {"entry": entry.to_dict(), "timestamp": time.time()}
    else:
        return {"success": False, "error": "DLQ entry not found"}


@ws_handler()
async def handle_get_dlq_stats(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get DLQ statistics.

    Returns:
        Total count, breakdown by node type and workflow
    """
    from services.execution import ExecutionCache
    cache_service = container.cache()
    execution_cache = ExecutionCache(cache_service)

    stats = await execution_cache.get_dlq_stats()
    return {"stats": stats, "timestamp": time.time()}


@ws_handler("entry_id")
async def handle_replay_dlq_entry(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Replay a failed node from the DLQ.

    Required:
        entry_id: DLQ entry ID to replay
        nodes: Workflow nodes
        edges: Workflow edges

    Returns:
        Replay execution result
    """
    from services.execution import ExecutionCache, WorkflowExecutor
    cache_service = container.cache()
    execution_cache = ExecutionCache(cache_service)
    workflow_service = container.workflow_service()
    broadcaster = get_status_broadcaster()

    entry_id = data["entry_id"]
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    # Get the entry to find the node_id
    entry = await execution_cache.get_dlq_entry(entry_id)
    if not entry:
        return {"success": False, "error": "DLQ entry not found"}

    # Update status
    await broadcaster.update_node_status(entry.node_id, "executing", {
        "message": "Replaying from DLQ"
    })

    # Create executor with node adapter
    async def node_executor(node_id: str, node_type: str, params: dict, context: dict) -> dict:
        return await workflow_service.execute_node(
            node_id=node_id,
            node_type=node_type,
            parameters=params,
            nodes=context.get("nodes", []),
            edges=context.get("edges", []),
            session_id=context.get("session_id", "dlq_replay"),
            execution_id=context.get("execution_id")
        )

    async def status_callback(node_id: str, status: str, status_data: dict):
        await broadcaster.update_node_status(node_id, status, status_data)

    # DLQ replay needs DLQ enabled to re-add on failure
    settings = container.settings()
    executor = WorkflowExecutor(
        cache=execution_cache,
        node_executor=node_executor,
        status_callback=status_callback,
        dlq_enabled=settings.dlq_enabled
    )

    result = await executor.replay_dlq_entry(entry_id, nodes, edges)

    # Update final status
    if result.get("success"):
        await broadcaster.update_node_status(entry.node_id, "success", result.get("result"))
    else:
        await broadcaster.update_node_status(entry.node_id, "error", {"error": result.get("error")})

    return result


@ws_handler("entry_id")
async def handle_remove_dlq_entry(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Remove an entry from the DLQ without replaying.

    Required:
        entry_id: DLQ entry ID to remove

    Returns:
        Success status
    """
    from services.execution import ExecutionCache
    cache_service = container.cache()
    execution_cache = ExecutionCache(cache_service)

    success = await execution_cache.remove_from_dlq(data["entry_id"])
    return {"removed": success, "entry_id": data["entry_id"]}


@ws_handler()
async def handle_purge_dlq(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Purge entries from the DLQ.

    Optional params:
        workflow_id: Only purge entries for this workflow
        node_type: Only purge entries for this node type
        older_than_hours: Only purge entries older than X hours

    Returns:
        Number of entries purged
    """
    from services.execution import ExecutionCache
    cache_service = container.cache()
    execution_cache = ExecutionCache(cache_service)

    older_than = None
    if data.get("older_than_hours"):
        older_than = time.time() - (data["older_than_hours"] * 3600)

    purged = await execution_cache.purge_dlq(
        workflow_id=data.get("workflow_id"),
        node_type=data.get("node_type"),
        older_than=older_than
    )

    return {"purged": purged, "timestamp": time.time()}


@ws_handler("node_id")
async def handle_get_node_output(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get output data for a specific node."""
    workflow_service = container.workflow_service()
    node_id = data["node_id"]
    output_name = data.get("output_name", "output_0")
    output_data = await workflow_service.get_node_output(data.get("session_id", "default"), node_id, output_name)
    return {"node_id": node_id, "output_name": output_name, "data": output_data, "timestamp": time.time()}


@ws_handler("node_id")
async def handle_clear_node_output(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Clear output data for a specific node from memory, database, and broadcaster cache."""
    workflow_service = container.workflow_service()
    database = container.database()
    broadcaster = get_status_broadcaster()
    node_id = data["node_id"]

    # Clear from memory - find keys ending with _{node_id}
    memory_cleared = 0
    keys_to_delete = [key for key in workflow_service.node_outputs.keys() if key.endswith(f"_{node_id}")]
    for key in keys_to_delete:
        del workflow_service.node_outputs[key]
        memory_cleared += 1

    # Clear from database (persisted storage)
    db_cleared = await database.delete_node_output(node_id)

    # Clear from broadcaster's status cache (prevents reload from showing old data)
    broadcaster_cleared = await broadcaster.clear_node_status(node_id)

    logger.info("Cleared node output", node_id=node_id, memory_cleared=memory_cleared,
                db_cleared=db_cleared, broadcaster_cleared=broadcaster_cleared)

    return {"node_id": node_id, "cleared": True, "memory_cleared": memory_cleared,
            "db_cleared": db_cleared, "broadcaster_cleared": broadcaster_cleared}


@ws_handler()
async def handle_execute_workflow(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Execute entire workflow from start node to end.

    Expects:
        workflow_id: Workflow identifier for per-workflow status scoping
        nodes: List of workflow nodes with {id, type, data}
        edges: List of edges with {id, source, target}
        session_id: Optional session identifier

    Returns:
        Workflow execution result with all node outputs
    """
    workflow_service = container.workflow_service()
    broadcaster = get_status_broadcaster()

    workflow_id = data.get("workflow_id")  # Per-workflow isolation (n8n pattern)
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    session_id = data.get("session_id", "default")

    if not nodes:
        return {"success": False, "error": "No nodes provided"}

    # Broadcast workflow starting status
    await broadcaster.update_workflow_status(executing=True, current_node=None, progress=0)

    # Create status callback with workflow_id for per-workflow scoping (n8n pattern)
    async def status_callback(node_id: str, status: str, node_data: Optional[Dict] = None):
        await broadcaster.update_node_status(node_id, status, node_data, workflow_id=workflow_id)
        if status == "executing":
            position = node_data.get("position", 0) if node_data else 0
            total = node_data.get("total", 1) if node_data else 1
            progress = int((position / total) * 100) if total > 0 else 0
            await broadcaster.update_workflow_status(executing=True, current_node=node_id, progress=progress)

    # Execute the workflow with workflow_id for per-workflow status scoping
    result = await workflow_service.execute_workflow(
        nodes=nodes,
        edges=edges,
        session_id=session_id,
        status_callback=status_callback,
        workflow_id=workflow_id,
    )

    # Broadcast workflow completed status
    await broadcaster.update_workflow_status(
        executing=False,
        current_node=None,
        progress=100 if result.get("success") else 0
    )

    return {
        "success": result.get("success", False),
        "nodes_executed": result.get("nodes_executed", []),
        "node_results": result.get("node_results", {}),
        "execution_order": result.get("execution_order", []),
        "errors": result.get("errors", []),
        "error": result.get("error"),
        "total_nodes": result.get("total_nodes", 0),
        "completed_nodes": result.get("completed_nodes", 0),
        "execution_time": result.get("execution_time", 0),
        "timestamp": time.time()
    }


# Per-workflow deployment tasks for proper cancellation (Temporal/n8n pattern)
# Maps workflow_id -> asyncio.Task for parallel workflow deployments
_deployment_tasks: Dict[str, asyncio.Task] = {}


@ws_handler()
async def handle_deploy_workflow(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Deploy workflow to run continuously until cancelled.

    Expects:
        workflow_id: Workflow identifier (required for locking)
        nodes: List of workflow nodes with {id, type, data}
        edges: List of edges with {id, source, target}
        session_id: Optional session identifier
        delay_between_runs: Optional delay in seconds between iterations (default: 1.0)

    Returns:
        Deployment start confirmation (deployment runs in background)
    """
    global _deployment_tasks
    workflow_service = container.workflow_service()
    broadcaster = get_status_broadcaster()

    workflow_id = data.get("workflow_id")
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    session_id = data.get("session_id", "default")

    # DEBUG: Log received edges to trace tool connection issues
    logger.debug(f"[Deploy] Received {len(edges)} edges for workflow {workflow_id}")
    for e in edges:
        target_handle = e.get('targetHandle')
        if target_handle and target_handle.startswith('input-') and target_handle != 'input-main':
            logger.debug(f"[Deploy] Config edge: {e.get('source')} -> {e.get('target')} (handle={target_handle})")

    # Check for tool connections to AI Agent
    tool_edges = [e for e in edges if e.get('targetHandle') == 'input-tools']
    if tool_edges:
        logger.debug(f"[Deploy] Tool edges found: {len(tool_edges)}")
        for te in tool_edges:
            logger.debug(f"[Deploy] Tool edge: source={te.get('source')} -> target={te.get('target')}")
    else:
        logger.debug(f"[Deploy] No input-tools edges found")

    if not nodes:
        return {"success": False, "error": "No nodes provided"}

    if not workflow_id:
        return {"success": False, "error": "workflow_id is required for deployment"}

    # Check if THIS specific workflow is already deployed (per-workflow isolation)
    if workflow_service.is_workflow_deployed(workflow_id):
        status = workflow_service.get_deployment_status(workflow_id)
        return {
            "success": False,
            "error": f"Workflow {workflow_id} is already deployed. Cancel it first.",
            "workflow_id": workflow_id,
            "is_running": True,
            "run_counter": status.get("run_counter", 0)
        }

    # Acquire workflow lock before starting deployment (per-workflow locking - n8n pattern)
    lock_acquired = await broadcaster.lock_workflow(workflow_id, reason="deployment")
    if not lock_acquired:
        lock_info = broadcaster.get_workflow_lock(workflow_id)
        return {
            "success": False,
            "error": f"Workflow {workflow_id} is already locked for {lock_info.get('reason', 'deployment')}",
            "locked_by": lock_info.get("workflow_id"),
            "locked_at": lock_info.get("locked_at")
        }

    # Broadcast deployment starting status using centralized method
    await broadcaster.update_workflow_status(executing=True, current_node=None, progress=0)
    await broadcaster.update_deployment_status(
        is_running=True,
        status="starting",
        active_runs=0,
        workflow_id=workflow_id
    )

    # Create status callback to broadcast node and deployment updates
    # Include workflow_id in all node status updates (n8n pattern for workflow isolation)
    async def status_callback(node_id: str, status: str, node_data: Optional[Dict] = None):
        if node_id == "__deployment__":
            # Deployment-level status update using centralized method
            active_runs = node_data.get("active_runs", 0) if node_data else 0
            await broadcaster.update_deployment_status(
                is_running=True,
                status=status,
                active_runs=active_runs,
                workflow_id=workflow_id,
                data=node_data
            )
        else:
            # Node-level status update with workflow_id for frontend filtering
            await broadcaster.update_node_status(node_id, status, node_data, workflow_id=workflow_id)
            if status == "executing":
                position = node_data.get("position", 0) if node_data else 0
                total = node_data.get("total", 1) if node_data else 1
                progress = int((position / total) * 100) if total > 0 else 0
                await broadcaster.update_workflow_status(executing=True, current_node=node_id, progress=progress)

    # Start deployment as background task (per-workflow - Temporal/n8n pattern)
    # In the event-driven pattern, deploy_workflow() returns immediately after setting up triggers.
    # The workflow stays locked until cancel_deployment is called.
    async def run_deployment():
        try:
            result = await workflow_service.deploy_workflow(
                nodes=nodes,
                edges=edges,
                session_id=session_id,
                status_callback=status_callback,
                workflow_id=workflow_id
            )

            # In event-driven mode, deploy_workflow returns immediately after trigger setup.
            # If it failed, unlock and report error. If successful, stay running.
            if not result.get("success"):
                # Setup failed - unlock and report error
                logger.error("Deployment setup failed", error=result.get("error"), workflow_id=workflow_id)
                await broadcaster.update_deployment_status(
                    is_running=False,
                    status="error",
                    active_runs=0,
                    workflow_id=workflow_id,
                    error=result.get("error")
                )
                await broadcaster.unlock_workflow(workflow_id)
                # Clean up task reference for this workflow
                _deployment_tasks.pop(workflow_id, None)
            else:
                # Deployment successful - triggers are set up and running.
                # Workflow stays locked until cancel_deployment is called.
                await broadcaster.update_deployment_status(
                    is_running=True,
                    status="running",
                    active_runs=0,
                    workflow_id=workflow_id,
                    data={
                        "triggers_setup": result.get("triggers_setup", []),
                        "deployment_id": result.get("deployment_id")
                    }
                )
                logger.info("[Deployment] Event-driven deployment active",
                           deployment_id=result.get("deployment_id"),
                           workflow_id=workflow_id,
                           triggers=len(result.get("triggers_setup", [])))

        except Exception as e:
            logger.error("Deployment task error", workflow_id=workflow_id, error=str(e))
            await broadcaster.update_deployment_status(
                is_running=False,
                status="error",
                active_runs=0,
                workflow_id=workflow_id,
                error=str(e)
            )
            await broadcaster.unlock_workflow(workflow_id)
            # Clean up task reference for this workflow
            _deployment_tasks.pop(workflow_id, None)

    # Store task per workflow for independent cancellation
    _deployment_tasks[workflow_id] = asyncio.create_task(run_deployment())

    return {
        "success": True,
        "message": "Deployment started",
        "workflow_id": workflow_id,
        "is_running": True,
        "locked": True,
        "timestamp": time.time()
    }


@ws_handler()
async def handle_cancel_deployment(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Cancel running deployment for a specific workflow (Temporal/n8n pattern).

    Expects:
        workflow_id: Workflow to cancel (required).

    Also cancels any active event waiters (trigger nodes) and unlocks the workflow.

    Returns:
        Cancellation result with iterations completed
    """
    global _deployment_tasks
    from services import event_waiter

    workflow_service = container.workflow_service()
    broadcaster = get_status_broadcaster()

    workflow_id = data.get("workflow_id")

    if not workflow_id:
        return {"success": False, "error": "workflow_id is required for cancellation"}

    result = await workflow_service.cancel_deployment(workflow_id)

    # Cancel event waiters for this specific workflow's nodes
    cancelled_waiters = 0
    if result.get("success"):
        cancelled_waiters = result.get("waiters_cancelled", 0)

    # Cancel the deployment task for THIS specific workflow only (per-workflow isolation)
    task = _deployment_tasks.pop(workflow_id, None)
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            logger.info("[Deployment] Deployment task cancelled", workflow_id=workflow_id)

    # Unlock this specific workflow
    if workflow_id:
        await broadcaster.unlock_workflow(workflow_id)

    if result.get("success"):
        # Clear node statuses for all trigger nodes that were waiting
        # The result contains info about cancelled listeners (listener_{node_id})
        # Use existing clear_node_status method which broadcasts node_status_cleared
        for node_id in result.get("cancelled_listener_node_ids", []):
            await broadcaster.clear_node_status(node_id)

        # Broadcast deployment cancelled status using centralized method
        await broadcaster.update_workflow_status(executing=False, current_node=None, progress=0)
        await broadcaster.update_deployment_status(
            is_running=False,
            status="cancelled",
            active_runs=0,
            workflow_id=workflow_id,
            data={
                "iterations_completed": result.get("iterations_completed", 0)
            }
        )

    return {
        "success": result.get("success", False),
        "message": result.get("message", result.get("error")),
        "workflow_id": workflow_id,
        "was_running": result.get("was_running", False),
        "iterations_completed": result.get("iterations_completed", 0),
        "cancelled_waiters": cancelled_waiters,
        "unlocked": workflow_id is not None,
        "timestamp": time.time()
    }


@ws_handler()
async def handle_get_deployment_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get current deployment status including workflow lock info.

    Expects (optional):
        workflow_id: Get status for specific workflow. If not provided, returns global status.

    Returns:
        Current deployment state, iteration count, and lock status
    """
    workflow_service = container.workflow_service()
    broadcaster = get_status_broadcaster()

    workflow_id = data.get("workflow_id")
    status = workflow_service.get_deployment_status(workflow_id)

    return {
        "is_running": workflow_service.is_deployment_running(workflow_id),
        "run_counter": status.get("run_counter", 0),
        "active_runs": status.get("active_runs", 0),
        "settings": workflow_service.get_deployment_settings(),
        "workflow_id": workflow_id or status.get("workflow_id"),
        "deployed_workflows": status.get("deployed_workflows", []),
        "lock": broadcaster.get_workflow_lock(),
        "timestamp": time.time()
    }


@ws_handler()
async def handle_get_workflow_lock(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get current workflow lock status.

    Returns:
        Current lock state including locked workflow_id and reason
    """
    broadcaster = get_status_broadcaster()

    return {
        "lock": broadcaster.get_workflow_lock(),
        "timestamp": time.time()
    }


@ws_handler()
async def handle_update_deployment_settings(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Update deployment settings (can be called during active deployment).

    Expects any of:
        delay_between_runs: float - Seconds to wait between iterations
        stop_on_error: bool - Stop deployment when a node fails
        max_iterations: int - Max iterations (0 = unlimited)

    Returns:
        Updated settings and current deployment state
    """
    workflow_service = container.workflow_service()
    broadcaster = get_status_broadcaster()

    settings_to_update = {}
    if "delay_between_runs" in data:
        settings_to_update["delay_between_runs"] = data["delay_between_runs"]
    if "stop_on_error" in data:
        settings_to_update["stop_on_error"] = data["stop_on_error"]
    if "max_iterations" in data:
        settings_to_update["max_iterations"] = data["max_iterations"]

    updated_settings = await workflow_service.update_deployment_settings(settings_to_update)

    # Broadcast settings update
    status = workflow_service.get_deployment_status()
    await broadcaster.broadcast({
        "type": "deployment_settings_updated",
        "settings": updated_settings,
        "is_running": workflow_service.is_deployment_running(),
        "run_counter": status.get("run_counter", 0)
    })

    return {
        "success": True,
        "settings": updated_settings,
        "is_running": workflow_service.is_deployment_running(),
        "run_counter": status.get("run_counter", 0),
        "active_runs": status.get("active_runs", 0),
        "timestamp": time.time()
    }


# ============================================================================
# AI Handlers
# ============================================================================

@ws_handler("node_id", "node_type")
async def handle_execute_ai_node(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Execute an AI node (chat model or agent)."""
    workflow_service = container.workflow_service()
    broadcaster = get_status_broadcaster()
    node_id, node_type = data["node_id"], data["node_type"]
    workflow_id = data.get("workflow_id")  # Per-workflow isolation for tool node glowing

    await broadcaster.update_node_status(node_id, "executing", workflow_id=workflow_id)
    result = await workflow_service.execute_node(
        node_id=node_id, node_type=node_type,
        parameters=data.get("parameters", {}),
        nodes=data.get("nodes", []), edges=data.get("edges", []),
        session_id=data.get("session_id", "default"),
        workflow_id=workflow_id,
    )

    if result.get("success"):
        await broadcaster.update_node_status(node_id, "success", result.get("result"), workflow_id=workflow_id)
        await broadcaster.update_node_output(node_id, result.get("result"), workflow_id=workflow_id)
    else:
        await broadcaster.update_node_status(node_id, "error", {"error": result.get("error")}, workflow_id=workflow_id)

    return {"success": result.get("success", False), "node_id": node_id, "result": result.get("result"), "error": result.get("error"),
            "execution_time": result.get("execution_time"), "timestamp": time.time()}


@ws_handler("provider", "api_key")
async def handle_get_ai_models(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get available AI models for a provider."""
    ai_service = container.ai_service()
    models = await ai_service.fetch_models(data["provider"], data["api_key"])
    return {"provider": data["provider"], "models": models, "timestamp": time.time()}


# ============================================================================
# API Key Handlers
# ============================================================================

@ws_handler("provider", "api_key")
async def handle_validate_api_key(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Validate and store an API key."""
    ai_service = container.ai_service()
    auth_service = container.auth_service()
    broadcaster = get_status_broadcaster()
    provider, api_key = data["provider"].lower(), data["api_key"].strip()

    models = await ai_service.fetch_models(provider, api_key)
    await auth_service.store_api_key(provider=provider, api_key=api_key, models=models,
                                      session_id=data.get("session_id", "default"))
    # Broadcast with hasKey and models so frontend can update reactively
    await broadcaster.update_api_key_status(
        provider=provider, valid=True, message="API key validated",
        has_key=True, models=models
    )
    return {"provider": provider, "valid": True, "models": models, "timestamp": time.time()}


@ws_handler("provider")
async def handle_get_stored_api_key(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get stored API key for a provider."""
    auth_service = container.auth_service()
    provider = data["provider"].lower()
    api_key = await auth_service.get_api_key(provider, data.get("session_id", "default"))
    if not api_key:
        return {"provider": provider, "has_key": False}
    models = await auth_service.get_stored_models(provider, data.get("session_id", "default"))
    return {"provider": provider, "has_key": True, "api_key": api_key, "models": models, "timestamp": time.time()}


@ws_handler("provider", "api_key")
async def handle_save_api_key(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Save an API key (without validation)."""
    auth_service = container.auth_service()
    await auth_service.store_api_key(provider=data["provider"].lower(), api_key=data["api_key"].strip(),
                                      models=data.get("models", []), session_id=data.get("session_id", "default"))
    return {"provider": data["provider"]}


@ws_handler("provider")
async def handle_delete_api_key(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Delete stored API key."""
    auth_service = container.auth_service()
    await auth_service.remove_api_key(data["provider"].lower(), data.get("session_id", "default"))
    return {"provider": data["provider"]}


# ============================================================================
# Claude OAuth Handlers
# ============================================================================

@ws_handler()
async def handle_claude_oauth_login(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Initiate Claude OAuth in isolated session."""
    from services.claude_oauth import initiate_claude_oauth
    return await initiate_claude_oauth()


@ws_handler()
async def handle_claude_oauth_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Check Claude OAuth credentials status."""
    from services.claude_oauth import get_claude_credentials
    return get_claude_credentials()


@ws_handler("url")
async def handle_test_ai_proxy(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Test connectivity to an AI proxy server."""
    import httpx

    url = data["url"].rstrip("/")
    timeout = data.get("timeout", 5.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # Try common health/models endpoints
            for endpoint in ["/v1/models", "/api/tags", "/health", "/"]:
                try:
                    response = await client.get(f"{url}{endpoint}")
                    if response.status_code < 500:
                        return {
                            "success": True,
                            "url": url,
                            "status_code": response.status_code,
                            "endpoint": endpoint,
                        }
                except httpx.RequestError:
                    continue

            return {
                "success": False,
                "url": url,
                "error": "No responding endpoints found",
            }
    except httpx.ConnectError:
        return {"success": False, "url": url, "error": "Connection refused"}
    except httpx.TimeoutException:
        return {"success": False, "url": url, "error": "Connection timeout"}
    except Exception as e:
        return {"success": False, "url": url, "error": str(e)}


# ============================================================================
# Android Handlers
# ============================================================================

@ws_handler()
async def handle_get_android_devices(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get list of connected Android devices."""
    android_service = container.android_service()
    devices = await android_service.list_devices()
    return {"devices": devices, "timestamp": time.time()}


@ws_handler("service_id", "action")
async def handle_execute_android_action(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Execute an Android service action."""
    android_service = container.android_service()
    broadcaster = get_status_broadcaster()
    service_id, action = data["service_id"], data["action"]
    node_id = data.get("node_id", f"android_{service_id}_{action}")

    await broadcaster.update_node_status(node_id, "executing")
    result = await android_service.execute_service(
        node_id=node_id, service_id=service_id, action=action,
        parameters=data.get("parameters", {}),
        android_host=data.get("android_host", "localhost"),
        android_port=data.get("android_port", 8888)
    )

    status = "success" if result.get("success") else "error"
    await broadcaster.update_node_status(node_id, status, result.get("result") or {"error": result.get("error")})
    return result


@ws_handler()
async def handle_android_relay_connect(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Connect to Android relay server.

    Establishes WebSocket connection to relay server and broadcasts QR code for pairing.
    Status updates are automatically broadcast via the relay client's broadcaster integration.
    """
    from services.android import get_relay_client

    url = data.get("url", "")
    api_key = data.get("api_key")

    if not url:
        return {
            "success": False,
            "connected": False,
            "error": "Relay URL is required"
        }

    if not api_key:
        return {
            "success": False,
            "connected": False,
            "error": "API key is required"
        }

    logger.info(f"[WebSocket] Android relay connect: {url}")

    try:
        client, error = await get_relay_client(url, api_key)
        if client:
            return {
                "success": True,
                "connected": True,
                "session_token": client.session_token,
                "qr_data": client.qr_data,
                "message": "Connected to relay server"
            }
        else:
            return {
                "success": False,
                "connected": False,
                "error": error or "Failed to connect to relay server"
            }
    except Exception as e:
        logger.error(f"[WebSocket] Android relay connect error: {e}")
        return {"success": False, "error": str(e)}


@ws_handler()
async def handle_android_relay_disconnect(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Disconnect from Android relay server.

    Closes the relay WebSocket connection and broadcasts disconnected status.
    """
    from services.android import close_relay_client

    logger.info("[WebSocket] Android relay disconnect requested")

    try:
        await close_relay_client()
        return {
            "success": True,
            "connected": False,
            "message": "Disconnected from relay server"
        }
    except Exception as e:
        logger.error(f"[WebSocket] Android relay disconnect error: {e}")
        return {"success": False, "error": str(e)}


@ws_handler()
async def handle_android_relay_reconnect(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Reconnect to Android relay server with a new session token.

    Forces disconnect and reconnect to get fresh session_token and QR code.
    Useful when pairing fails or Android device needs to re-pair.
    """
    from services.android import close_relay_client, get_relay_client

    url = data.get("url", "")
    api_key = data.get("api_key")

    if not url:
        return {
            "success": False,
            "connected": False,
            "error": "Relay URL is required"
        }

    if not api_key:
        return {
            "success": False,
            "connected": False,
            "error": "API key is required"
        }

    logger.info("[WebSocket] Android relay reconnect: forcing new session")

    try:
        # Force disconnect existing connection
        await close_relay_client()

        # Small delay to ensure clean disconnect
        await asyncio.sleep(0.5)

        # Reconnect with fresh session
        client, error = await get_relay_client(url, api_key)
        if client:
            return {
                "success": True,
                "connected": True,
                "session_token": client.session_token,
                "qr_data": client.qr_data,
                "message": "Reconnected with new session token"
            }
        else:
            return {
                "success": False,
                "connected": False,
                "error": error or "Failed to reconnect to relay server"
            }
    except Exception as e:
        logger.error(f"[WebSocket] Android relay reconnect error: {e}")
        return {"success": False, "error": str(e)}


# ============================================================================
# Maps Handlers
# ============================================================================

async def handle_validate_maps_key(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Validate Google Maps API key and save to database if valid."""
    import httpx
    broadcaster = get_status_broadcaster()
    auth_service = container.auth_service()

    api_key = data.get("api_key", "").strip()
    session_id = data.get("session_id", "default")

    if not api_key:
        return {"success": False, "valid": False, "error": "api_key required"}

    try:
        # Test the API key with a simple geocoding request
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "address": "1600 Amphitheatre Parkway, Mountain View, CA",
                    "key": api_key
                },
                timeout=10.0
            )

            response_data = response.json()

            if response_data.get("status") == "OK":
                # Save the validated key to database
                await auth_service.store_api_key(
                    provider="google_maps",
                    api_key=api_key,
                    models=[],
                    session_id=session_id
                )
                await broadcaster.update_api_key_status(
                    provider="google_maps",
                    valid=True,
                    message="API key validated successfully"
                )
                return {"success": True, "valid": True, "message": "Google Maps API key is valid"}

            elif response_data.get("status") == "REQUEST_DENIED":
                error_msg = response_data.get("error_message", "Invalid API key")
                await broadcaster.update_api_key_status(
                    provider="google_maps",
                    valid=False,
                    message=error_msg
                )
                return {"success": True, "valid": False, "message": error_msg}

            else:
                # Other statuses like ZERO_RESULTS still mean the key works
                # Save the validated key to database
                await auth_service.store_api_key(
                    provider="google_maps",
                    api_key=api_key,
                    models=[],
                    session_id=session_id
                )
                await broadcaster.update_api_key_status(
                    provider="google_maps",
                    valid=True,
                    message="API key validated"
                )
                return {"success": True, "valid": True, "message": f"API key is valid (status: {response_data.get('status')})"}

    except httpx.TimeoutException:
        await broadcaster.update_api_key_status(
            provider="google_maps",
            valid=False,
            message="Validation request timed out"
        )
        return {"success": False, "valid": False, "error": "Validation request timed out"}

    except Exception as e:
        logger.error("Maps key validation failed", error=str(e))
        await broadcaster.update_api_key_status(
            provider="google_maps",
            valid=False,
            message=str(e)
        )
        return {"success": False, "valid": False, "error": str(e)}


# ============================================================================
# WhatsApp Handlers - Wrappers for routers.whatsapp functions
# ============================================================================

from routers.whatsapp import (
    handle_whatsapp_status as _wa_status,
    handle_whatsapp_qr as _wa_qr,
    handle_whatsapp_send as _wa_send,
    handle_whatsapp_start as _wa_start,
    handle_whatsapp_restart as _wa_restart,
    handle_whatsapp_groups as _wa_groups,
    handle_whatsapp_group_info as _wa_group_info,
    handle_whatsapp_chat_history as _wa_chat_history,
    whatsapp_rpc_call as _wa_rpc_call,
)


async def handle_whatsapp_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    return await _wa_status()


async def handle_whatsapp_qr(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    return await _wa_qr()


async def handle_whatsapp_send(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Forward all send params to WhatsApp handler - supports all message types."""
    return await _wa_send(data)


async def handle_whatsapp_start(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    return await _wa_start()


async def handle_whatsapp_restart(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    return await _wa_restart()


async def handle_whatsapp_groups(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    return await _wa_groups()


async def handle_whatsapp_group_info(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get group participants with resolved phone numbers."""
    group_id = data.get("group_id", "")
    return await _wa_group_info(group_id)


async def handle_whatsapp_chat_history(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get chat history from WhatsApp history store."""
    return await _wa_chat_history(data)


async def handle_whatsapp_rate_limit_get(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get rate limit config and current stats."""
    result = await _wa_rpc_call("rate_limit_get", {})
    return result


async def handle_whatsapp_rate_limit_set(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Update rate limit configuration."""
    config = data.get("config", {})
    result = await _wa_rpc_call("rate_limit_set", config)
    return result


async def handle_whatsapp_rate_limit_stats(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get current rate limit statistics."""
    result = await _wa_rpc_call("rate_limit_stats", {})
    return result


async def handle_whatsapp_rate_limit_unpause(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Resume rate limiting after automatic pause."""
    result = await _wa_rpc_call("rate_limit_unpause", {})
    return result


# ============================================================================
# Workflow Storage Operations
# ============================================================================

async def handle_save_workflow(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Save workflow to database."""
    database = container.database()
    success = await database.save_workflow(
        workflow_id=data["workflow_id"],
        name=data["name"],
        data=data.get("data", {})
    )
    return {"success": success, "workflow_id": data["workflow_id"]}


async def handle_get_workflow(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get workflow by ID."""
    database = container.database()
    workflow = await database.get_workflow(data["workflow_id"])
    if workflow:
        return {
            "success": True,
            "workflow": {
                "id": workflow.id,
                "name": workflow.name,
                "data": workflow.data,
                "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
                "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None
            }
        }
    return {"success": False, "error": "Workflow not found"}


async def handle_get_all_workflows(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get all workflows."""
    database = container.database()
    workflows = await database.get_all_workflows()
    return {
        "success": True,
        "workflows": [
            {
                "id": w.id,
                "name": w.name,
                "nodeCount": len(w.data.get("nodes", [])) if w.data else 0,
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "updated_at": w.updated_at.isoformat() if w.updated_at else None
            }
            for w in workflows
        ]
    }


async def handle_delete_workflow(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Delete workflow."""
    database = container.database()
    success = await database.delete_workflow(data["workflow_id"])
    return {"success": success, "workflow_id": data["workflow_id"]}


# ============================================================================
# Chat Message Handler (for chatTrigger nodes)
# ============================================================================

@ws_handler("message")
async def handle_send_chat_message(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Handle chat message from console panel - dispatches to chatTrigger nodes.

    This handler receives messages from the frontend chat panel and dispatches
    them as 'chat_message_received' events to any waiting chatTrigger nodes.
    Also saves the message to database for persistence across restarts.
    """
    from services import event_waiter

    message = data["message"]
    role = data.get("role", "user")
    session_id = data.get("session_id", "default")
    timestamp = data.get("timestamp") or datetime.now().isoformat()

    # Save to database for persistence
    database = container.database()
    await database.add_chat_message(session_id, role, message)

    # Build event data matching chatTrigger output schema
    event_data = {
        "message": message,
        "timestamp": timestamp,
        "session_id": session_id
    }

    # Dispatch to chatTrigger waiters
    resolved = event_waiter.dispatch("chat_message_received", event_data)

    logger.info(f"[ChatMessage] Dispatched message to {resolved} chatTrigger waiter(s)")

    return {
        "success": True,
        "message": "Chat message sent",
        "resolved_count": resolved,
        "timestamp": timestamp
    }


@ws_handler()
async def handle_get_chat_messages(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get chat messages from database for a session."""
    session_id = data.get("session_id", "default")
    limit = data.get("limit")  # Optional limit

    database = container.database()
    messages = await database.get_chat_messages(session_id, limit)

    return {
        "success": True,
        "messages": messages,
        "session_id": session_id
    }


@ws_handler()
async def handle_clear_chat_messages(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Clear all chat messages for a session."""
    session_id = data.get("session_id", "default")

    database = container.database()
    count = await database.clear_chat_messages(session_id)

    return {
        "success": True,
        "message": f"Cleared {count} chat messages",
        "cleared_count": count
    }


@ws_handler()
async def handle_get_console_logs(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get console logs from database."""
    limit = data.get("limit", 100)

    database = container.database()
    logs = await database.get_console_logs(limit)

    return {
        "success": True,
        "logs": logs
    }


@ws_handler()
async def handle_clear_console_logs(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Clear all console logs from database and memory."""
    database = container.database()
    count = await database.clear_console_logs()

    # Also clear in-memory logs
    broadcaster = get_status_broadcaster()
    if "console_logs" in broadcaster._status:
        broadcaster._status["console_logs"] = []

    return {
        "success": True,
        "message": f"Cleared {count} console logs",
        "cleared_count": count
    }


@ws_handler("message", "role")
async def handle_save_chat_message(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Save a single chat message (used for assistant responses)."""
    message = data["message"]
    role = data["role"]
    session_id = data.get("session_id", "default")

    database = container.database()
    success = await database.add_chat_message(session_id, role, message)

    return {
        "success": success,
        "message": "Chat message saved" if success else "Failed to save chat message"
    }


@ws_handler()
async def handle_get_chat_sessions(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get list of all chat sessions."""
    database = container.database()
    sessions = await database.get_chat_sessions()

    return {
        "success": True,
        "sessions": sessions
    }


# ============================================================================
# Terminal Logs Handlers
# ============================================================================

@ws_handler()
async def handle_get_terminal_logs(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get terminal log history."""
    broadcaster = get_status_broadcaster()
    logs = broadcaster.get_terminal_logs()
    return {"success": True, "logs": logs}


@ws_handler()
async def handle_clear_terminal_logs(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Clear terminal log history."""
    broadcaster = get_status_broadcaster()
    await broadcaster.clear_terminal_logs()
    return {"success": True, "message": "Terminal logs cleared"}


# ============================================================================
# User Skills Handlers
# ============================================================================

@ws_handler("skill_name")
async def handle_get_skill_content(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get skill content (instructions) by skill name.

    Works for both built-in skills (from SKILL.md files) and user skills (from database).
    """
    from services.skill_loader import get_skill_loader

    skill_name = data["skill_name"]
    skill_loader = get_skill_loader()

    # Try to load the skill
    skill = skill_loader.load_skill(skill_name)
    if skill:
        return {
            "success": True,
            "skill_name": skill_name,
            "instructions": skill.instructions,
            "description": skill.metadata.description,
            "allowed_tools": skill.metadata.allowed_tools,
            "is_builtin": skill.metadata.path is not None,
            "timestamp": time.time()
        }

    # Try loading from database for user skills
    database = container.database()
    user_skill = await database.get_user_skill(skill_name)
    if user_skill:
        return {
            "success": True,
            "skill_name": skill_name,
            "instructions": user_skill.instructions,
            "description": user_skill.description,
            "allowed_tools": user_skill.allowed_tools.split(',') if user_skill.allowed_tools else [],
            "is_builtin": False,
            "timestamp": time.time()
        }

    return {"success": False, "error": f"Skill '{skill_name}' not found"}


@ws_handler("skill_name", "instructions")
async def handle_save_skill_content(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Save skill content (instructions) by skill name.

    For built-in skills, writes to the SKILL.md file.
    For user skills, updates the database.
    """
    import re
    from pathlib import Path
    from services.skill_loader import get_skill_loader

    skill_name = data["skill_name"]
    new_instructions = data["instructions"]
    skill_loader = get_skill_loader()

    # Check if it's a built-in skill
    if skill_name in skill_loader._registry:
        metadata = skill_loader._registry[skill_name]
        if metadata.path is not None:
            # It's a built-in skill - update SKILL.md file
            skill_md_path = metadata.path / "SKILL.md"

            if not skill_md_path.exists():
                return {"success": False, "error": f"SKILL.md not found for '{skill_name}'"}

            # Read existing file to preserve frontmatter
            content = skill_md_path.read_text(encoding='utf-8')

            # Parse frontmatter
            frontmatter_match = re.match(r'^(---\s*\n.*?\n---\s*\n)', content, re.DOTALL)
            if frontmatter_match:
                # Keep frontmatter, replace body
                new_content = frontmatter_match.group(1) + new_instructions
            else:
                # No frontmatter, just write instructions
                new_content = new_instructions

            # Write back to file
            skill_md_path.write_text(new_content, encoding='utf-8')

            # Clear cache so next load gets fresh content
            skill_loader.clear_cache()

            logger.info(f"[Skills] Updated built-in skill: {skill_name}")
            return {
                "success": True,
                "skill_name": skill_name,
                "is_builtin": True,
                "message": f"Skill '{skill_name}' saved to SKILL.md",
                "timestamp": time.time()
            }

    # It's a user skill - update in database
    database = container.database()
    user_skill = await database.get_user_skill(skill_name)
    if user_skill:
        updated = await database.update_user_skill(
            name=skill_name,
            instructions=new_instructions
        )
        if updated:
            logger.info(f"[Skills] Updated user skill: {skill_name}")
            return {
                "success": True,
                "skill_name": skill_name,
                "is_builtin": False,
                "message": f"Skill '{skill_name}' saved to database",
                "timestamp": time.time()
            }

    return {"success": False, "error": f"Skill '{skill_name}' not found"}


@ws_handler()
async def handle_list_skill_folders(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """List top-level subdirectories under server/skills/.

    Returns folder names for the skill folder dropdown in MasterSkillEditor.
    """
    from pathlib import Path

    server_dir = Path(__file__).parent.parent
    skills_dir = server_dir / "skills"

    folders = []
    if skills_dir.exists():
        for item in sorted(skills_dir.iterdir()):
            if item.is_dir() and not item.name.startswith('.'):
                # Count SKILL.md files inside
                skill_count = len(list(item.rglob("SKILL.md")))
                folders.append({
                    "name": item.name,
                    "skill_count": skill_count
                })

    return {"success": True, "folders": folders}


@ws_handler("folder")
async def handle_scan_skill_folder(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Scan a subfolder under server/skills/ for SKILL.md files.

    Returns list of discovered skills with their metadata.
    Used by MasterSkillEditor when skillFolder is set.
    Also registers discovered skills in the global registry for get_skill_content.
    """
    from pathlib import Path
    from services.skill_loader import get_skill_loader

    folder = data["folder"]
    server_dir = Path(__file__).parent.parent
    target_dir = server_dir / "skills" / folder

    if not target_dir.exists():
        return {"success": False, "error": f"Folder not found: skills/{folder}"}

    skill_loader = get_skill_loader()
    skills = []
    for skill_md in target_dir.rglob("SKILL.md"):
        metadata = skill_loader._parse_skill_metadata(skill_md)
        if metadata:
            # Register the skill in the global registry so get_skill_content can find it
            metadata.path = skill_md.parent
            skill_loader._registry[metadata.name] = metadata

            skills.append({
                "name": metadata.name,
                "description": metadata.description,
                "metadata": metadata.metadata
            })

    return {"success": True, "skills": skills, "folder": folder}


@ws_handler()
async def handle_get_user_skills(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get all user-created skills."""
    database = container.database()
    active_only = data.get("active_only", True)
    skills = await database.get_all_user_skills(active_only=active_only)
    return {"skills": skills, "count": len(skills), "timestamp": time.time()}


@ws_handler("name")
async def handle_get_user_skill(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get a specific user skill by name."""
    database = container.database()
    skill = await database.get_user_skill(data["name"])
    if skill:
        return {"skill": skill, "timestamp": time.time()}
    return {"success": False, "error": f"Skill '{data['name']}' not found"}


@ws_handler("name", "display_name", "description", "instructions")
async def handle_create_user_skill(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Create a new user skill."""
    database = container.database()
    broadcaster = get_status_broadcaster()

    skill = await database.create_user_skill(
        name=data["name"],
        display_name=data["display_name"],
        description=data["description"],
        instructions=data["instructions"],
        allowed_tools=data.get("allowed_tools"),
        category=data.get("category", "custom"),
        icon=data.get("icon", "star"),
        color=data.get("color", "#6366F1"),
        metadata_json=data.get("metadata"),
        created_by=data.get("created_by")
    )

    if skill:
        # Broadcast skill created to all clients
        await broadcaster.broadcast({
            "type": "user_skill_created",
            "skill": skill,
            "timestamp": time.time()
        })
        return {"skill": skill, "timestamp": time.time()}
    return {"success": False, "error": f"Failed to create skill. Name '{data['name']}' may already exist."}


@ws_handler("name")
async def handle_update_user_skill(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Update an existing user skill."""
    database = container.database()
    broadcaster = get_status_broadcaster()

    skill = await database.update_user_skill(
        name=data["name"],
        display_name=data.get("display_name"),
        description=data.get("description"),
        instructions=data.get("instructions"),
        allowed_tools=data.get("allowed_tools"),
        category=data.get("category"),
        icon=data.get("icon"),
        color=data.get("color"),
        metadata_json=data.get("metadata"),
        is_active=data.get("is_active")
    )

    if skill:
        # Broadcast skill updated to all clients
        await broadcaster.broadcast({
            "type": "user_skill_updated",
            "skill": skill,
            "timestamp": time.time()
        })
        return {"skill": skill, "timestamp": time.time()}
    return {"success": False, "error": f"Skill '{data['name']}' not found"}


@ws_handler("name")
async def handle_delete_user_skill(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Delete a user skill."""
    database = container.database()
    broadcaster = get_status_broadcaster()

    deleted = await database.delete_user_skill(data["name"])

    if deleted:
        # Broadcast skill deleted to all clients
        await broadcaster.broadcast({
            "type": "user_skill_deleted",
            "name": data["name"],
            "timestamp": time.time()
        })
        return {"deleted": True, "name": data["name"], "timestamp": time.time()}
    return {"success": False, "error": f"Skill '{data['name']}' not found"}


# ============================================================================
# Memory and Skill Clear/Reset Handlers
# ============================================================================

@ws_handler()
async def handle_clear_memory(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Clear memory content and optionally the long-term vector store."""
    from services.ai import _memory_vector_stores

    session_id = data.get("session_id", "default")
    clear_long_term = data.get("clear_long_term", False)

    default_content = "# Conversation History\n\n*No messages yet.*\n"
    cleared_vector_store = False

    if clear_long_term and session_id in _memory_vector_stores:
        del _memory_vector_stores[session_id]
        cleared_vector_store = True
        logger.info(f"[Memory] Cleared vector store for session '{session_id}'")

    logger.info(f"[Memory] Cleared memory content for session '{session_id}', vector_store={cleared_vector_store}")

    return {
        "success": True,
        "default_content": default_content,
        "cleared_vector_store": cleared_vector_store,
        "session_id": session_id
    }


@ws_handler("skill_name")
async def handle_reset_skill(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get original SKILL.md content for resetting a built-in skill."""
    import re
    from services.skill_loader import get_skill_loader

    skill_name = data["skill_name"]
    skill_loader = get_skill_loader()

    # Check if skill exists in registry
    if skill_name not in skill_loader._registry:
        return {"success": False, "error": f"Skill '{skill_name}' not found"}

    metadata = skill_loader._registry[skill_name]

    # User skills don't have a default to reset to
    if metadata.path is None:
        return {"success": False, "error": f"Cannot reset user skill '{skill_name}' - no default exists"}

    skill_md_path = metadata.path / "SKILL.md"
    if not skill_md_path.exists():
        return {"success": False, "error": f"SKILL.md not found for '{skill_name}'"}

    content = skill_md_path.read_text(encoding='utf-8')

    # Extract body after frontmatter
    frontmatter_match = re.match(r'^---\s*\n.*?\n---\s*\n', content, re.DOTALL)
    if frontmatter_match:
        original_instructions = content[frontmatter_match.end():]
    else:
        original_instructions = content

    logger.info(f"[Skill] Reset skill '{skill_name}' to default content")

    return {
        "success": True,
        "skill_name": skill_name,
        "original_content": original_instructions,
        "is_builtin": True
    }


# ============================================================================
# User Settings Handlers
# ============================================================================

@ws_handler()
async def handle_get_user_settings(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get user settings from database."""
    database = container.database()
    user_id = data.get("user_id", "default")
    settings = await database.get_user_settings(user_id)

    # Return default settings if none exist
    if settings is None:
        settings = {
            "user_id": user_id,
            "auto_save": True,
            "auto_save_interval": 30,
            "sidebar_default_open": True,
            "component_palette_default_open": True
        }

    return {"settings": settings}


@ws_handler()
async def handle_save_user_settings(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Save user settings to database."""
    database = container.database()
    user_id = data.get("user_id", "default")
    settings_data = data.get("settings", {})

    success = await database.save_user_settings(settings_data, user_id)

    if success:
        # Fetch the saved settings to return
        settings = await database.get_user_settings(user_id)
        return {"settings": settings}
    else:
        return {"success": False, "error": "Failed to save settings"}


# ============================================================================
# Compaction Handlers
# ============================================================================

@ws_handler("session_id")
async def handle_get_compaction_stats(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Get compaction statistics for a session."""
    from services.compaction import get_compaction_service
    svc = get_compaction_service()
    if not svc:
        return {"success": False, "error": "Compaction service not initialized"}
    return await svc.stats(data["session_id"])


@ws_handler("session_id")
async def handle_configure_compaction(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Configure compaction settings for a session."""
    from services.compaction import get_compaction_service
    svc = get_compaction_service()
    if not svc:
        return {"success": False, "error": "Compaction service not initialized"}
    success = await svc.configure(data["session_id"], data.get("threshold"), data.get("enabled"))
    return {"success": success}


# ============================================================================
# Message Router
# ============================================================================

MESSAGE_HANDLERS: Dict[str, MessageHandler] = {
    # Status/ping
    "ping": handle_ping,
    "get_status": handle_get_status,
    "get_android_status": handle_get_android_status,
    "get_node_status": handle_get_node_status,
    "get_variable": handle_get_variable,

    # Node parameters
    "get_node_parameters": handle_get_node_parameters,
    "get_all_node_parameters": handle_get_all_node_parameters,
    "save_node_parameters": handle_save_node_parameters,
    "delete_node_parameters": handle_delete_node_parameters,

    # Tool schemas (source of truth for tool configurations)
    "get_tool_schema": handle_get_tool_schema,
    "save_tool_schema": handle_save_tool_schema,
    "delete_tool_schema": handle_delete_tool_schema,
    "get_all_tool_schemas": handle_get_all_tool_schemas,

    # Node execution
    "execute_node": handle_execute_node,
    "execute_workflow": handle_execute_workflow,
    "cancel_execution": handle_cancel_execution,
    "get_node_output": handle_get_node_output,
    "clear_node_output": handle_clear_node_output,

    # Trigger/event waiting
    "cancel_event_wait": handle_cancel_event_wait,
    "get_active_waiters": handle_get_active_waiters,

    # Dead Letter Queue (DLQ) operations
    "get_dlq_entries": handle_get_dlq_entries,
    "get_dlq_entry": handle_get_dlq_entry,
    "get_dlq_stats": handle_get_dlq_stats,
    "replay_dlq_entry": handle_replay_dlq_entry,
    "remove_dlq_entry": handle_remove_dlq_entry,
    "purge_dlq": handle_purge_dlq,

    # Deployment operations
    "deploy_workflow": handle_deploy_workflow,
    "cancel_deployment": handle_cancel_deployment,
    "get_deployment_status": handle_get_deployment_status,
    "get_workflow_lock": handle_get_workflow_lock,
    "update_deployment_settings": handle_update_deployment_settings,

    # AI operations
    "execute_ai_node": handle_execute_ai_node,
    "get_ai_models": handle_get_ai_models,

    # API key operations
    "validate_api_key": handle_validate_api_key,
    "get_stored_api_key": handle_get_stored_api_key,
    "save_api_key": handle_save_api_key,
    "delete_api_key": handle_delete_api_key,

    # Claude OAuth operations
    "claude_oauth_login": handle_claude_oauth_login,
    "claude_oauth_status": handle_claude_oauth_status,

    # Android operations
    "get_android_devices": handle_get_android_devices,
    "execute_android_action": handle_execute_android_action,
    "android_relay_connect": handle_android_relay_connect,
    "android_relay_disconnect": handle_android_relay_disconnect,
    "android_relay_reconnect": handle_android_relay_reconnect,

    # Maps operations
    "validate_maps_key": handle_validate_maps_key,

    # WhatsApp operations
    "whatsapp_status": handle_whatsapp_status,
    "whatsapp_qr": handle_whatsapp_qr,
    "whatsapp_send": handle_whatsapp_send,
    "whatsapp_start": handle_whatsapp_start,
    "whatsapp_restart": handle_whatsapp_restart,
    "whatsapp_groups": handle_whatsapp_groups,
    "whatsapp_group_info": handle_whatsapp_group_info,
    "whatsapp_chat_history": handle_whatsapp_chat_history,
    "whatsapp_rate_limit_get": handle_whatsapp_rate_limit_get,
    "whatsapp_rate_limit_set": handle_whatsapp_rate_limit_set,
    "whatsapp_rate_limit_stats": handle_whatsapp_rate_limit_stats,
    "whatsapp_rate_limit_unpause": handle_whatsapp_rate_limit_unpause,

    # Workflow storage operations
    "save_workflow": handle_save_workflow,
    "get_workflow": handle_get_workflow,
    "get_all_workflows": handle_get_all_workflows,
    "delete_workflow": handle_delete_workflow,

    # Chat message (for chatTrigger nodes)
    "send_chat_message": handle_send_chat_message,
    "get_chat_messages": handle_get_chat_messages,
    "clear_chat_messages": handle_clear_chat_messages,
    "save_chat_message": handle_save_chat_message,

    # Console logs (for Console nodes)
    "get_console_logs": handle_get_console_logs,
    "clear_console_logs": handle_clear_console_logs,

    # Terminal logs
    "get_terminal_logs": handle_get_terminal_logs,
    "clear_terminal_logs": handle_clear_terminal_logs,

    # User Skills
    "get_user_skills": handle_get_user_skills,
    "get_user_skill": handle_get_user_skill,
    "create_user_skill": handle_create_user_skill,
    "update_user_skill": handle_update_user_skill,
    "delete_user_skill": handle_delete_user_skill,

    # Skill Content (built-in and user skills)
    "get_skill_content": handle_get_skill_content,
    "save_skill_content": handle_save_skill_content,
    "scan_skill_folder": handle_scan_skill_folder,
    "list_skill_folders": handle_list_skill_folders,

    # Memory and Skill Clear/Reset
    "clear_memory": handle_clear_memory,
    "reset_skill": handle_reset_skill,

    # User Settings
    "get_user_settings": handle_get_user_settings,
    "save_user_settings": handle_save_user_settings,

    # Compaction
    "get_compaction_stats": handle_get_compaction_stats,
    "configure_compaction": handle_configure_compaction,
}


async def _execute_handler(
    handler: MessageHandler,
    data: Dict[str, Any],
    websocket: WebSocket,
    msg_type: str,
    request_id: Optional[str]
):
    """Execute handler and send response using safe send."""
    try:
        result = await handler(data, websocket)

        if request_id:
            await _safe_send(websocket, {
                "type": f"{msg_type}_result",
                "request_id": request_id,
                **result
            })
        else:
            await _safe_send(websocket, result)

    except asyncio.CancelledError:
        # Task was cancelled (e.g., WebSocket disconnected)
        logger.debug(f"[WebSocket] Handler cancelled: {msg_type}")
        raise
    except Exception as e:
        logger.error("Handler error", msg_type=msg_type, error=str(e))
        if request_id:
            await _safe_send(websocket, {
                "type": f"{msg_type}_result",
                "request_id": request_id,
                "success": False,
                "error": str(e)
            })


@router.websocket("/ws/status")
async def websocket_status_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time bidirectional communication.

    Uses decoupled receive/process pattern with asyncio.Queue:
    - Receive task: continuously receives messages into queue (never blocks)
    - Process task: reads from queue and spawns handler tasks (can be long-running)

    This ensures cancel messages are always processed immediately, even when
    long-running handlers (like trigger node execution) are active.

    All client requests include a request_id for correlation.
    The server responds with the same request_id for request/response matching.
    Broadcasts (without request_id) are sent to all connected clients.
    """
    # Authenticate via cookie before accepting connection
    settings = container.settings()

    # Check if auth is disabled (VITE_AUTH_ENABLED=false)
    auth_disabled = settings.vite_auth_enabled and settings.vite_auth_enabled.lower() == 'false'

    if not auth_disabled:
        # Auth enabled - verify token
        token = websocket.cookies.get(settings.jwt_cookie_name)

        if not token:
            await websocket.close(code=4001, reason="Not authenticated")
            return

        user_auth = container.user_auth_service()
        payload = user_auth.verify_token(token)

        if not payload:
            await websocket.close(code=4001, reason="Invalid or expired session")
            return

    broadcaster = get_status_broadcaster()
    await broadcaster.connect(websocket)

    # Message queue for decoupling receive from processing
    message_queue: asyncio.Queue = asyncio.Queue()

    # Track handler tasks for this WebSocket
    handler_tasks: Set[asyncio.Task] = set()
    _handler_tasks[websocket] = handler_tasks

    async def receive_loop():
        """Receives messages and puts them in queue - never blocks on handlers."""
        try:
            while True:
                data = await websocket.receive_json()
                await message_queue.put(data)
        except WebSocketDisconnect:
            # Don't log here - logging during shutdown can raise KeyboardInterrupt
            await message_queue.put(None)  # Signal shutdown
        except asyncio.CancelledError:
            # Task cancelled during shutdown - this is expected
            await message_queue.put(None)
            raise
        except Exception as e:
            # Only log if it's not a shutdown-related error
            if not isinstance(e, (KeyboardInterrupt, SystemExit)):
                logger.error(f"[WebSocket] Receive error: {e}")
            await message_queue.put(None)

    async def process_loop():
        """Processes messages from queue - spawns handler tasks that can run concurrently."""
        while True:
            data = await message_queue.get()

            if data is None:  # Shutdown signal
                break

            msg_type = data.get("type", "")
            request_id = data.get("request_id")

            logger.debug("WebSocket message received", msg_type=msg_type, has_request_id=bool(request_id))

            handler = MESSAGE_HANDLERS.get(msg_type)

            if handler:
                # Run handler as task so it doesn't block queue processing
                # This allows cancel_event_wait to be processed while execute_node is waiting
                task = asyncio.create_task(
                    _execute_handler(handler, data, websocket, msg_type, request_id)
                )
                handler_tasks.add(task)
                task.add_done_callback(handler_tasks.discard)
            else:
                logger.warning("Unknown message type", msg_type=msg_type)
                if request_id:
                    await _safe_send(websocket, {
                        "type": "error",
                        "request_id": request_id,
                        "code": "UNKNOWN_MESSAGE_TYPE",
                        "message": f"Unknown message type: {msg_type}"
                    })

    try:
        # Run receive and process loops concurrently using TaskGroup (Python 3.11+)
        async with asyncio.TaskGroup() as tg:
            tg.create_task(receive_loop())
            tg.create_task(process_loop())

    except* WebSocketDisconnect:
        pass  # Normal disconnect - don't log during shutdown
    except* asyncio.CancelledError:
        pass  # Task cancelled during shutdown - expected
    except* (KeyboardInterrupt, SystemExit):
        pass  # Server shutdown - don't log
    except* Exception as eg:
        for exc in eg.exceptions:
            if not isinstance(exc, (WebSocketDisconnect, asyncio.CancelledError, KeyboardInterrupt, SystemExit)):
                logger.error(f"[WebSocket] TaskGroup error: {exc}")
    finally:
        # Cancel any running handler tasks on disconnect
        for task in list(handler_tasks):
            if not task.done():
                task.cancel()

        # Wait for tasks to finish cancellation
        if handler_tasks:
            await asyncio.gather(*handler_tasks, return_exceptions=True)

        # Cleanup
        _handler_tasks.pop(websocket, None)
        await broadcaster.disconnect(websocket)


@router.websocket("/ws/internal")
async def websocket_internal_endpoint(websocket: WebSocket):
    """Internal WebSocket endpoint for Temporal workers.

    This endpoint bypasses authentication and is intended for internal
    service-to-service communication (e.g., Temporal activity -> MachinaOs).

    Security: Should only be exposed on localhost/internal network.
    """
    broadcaster = get_status_broadcaster()
    await websocket.accept()

    logger.info("[WebSocket Internal] Temporal worker connected")

    # Message queue for decoupling receive from processing
    message_queue: asyncio.Queue = asyncio.Queue()

    # Track handler tasks for this WebSocket
    handler_tasks: Set[asyncio.Task] = set()

    async def receive_loop():
        """Receives messages and puts them in queue."""
        try:
            while True:
                data = await websocket.receive_json()
                await message_queue.put(data)
        except WebSocketDisconnect:
            await message_queue.put(None)
        except asyncio.CancelledError:
            await message_queue.put(None)
            raise
        except Exception as e:
            if not isinstance(e, (KeyboardInterrupt, SystemExit)):
                logger.error(f"[WebSocket Internal] Receive error: {e}")
            await message_queue.put(None)

    async def process_loop():
        """Processes messages from queue."""
        while True:
            data = await message_queue.get()

            if data is None:
                break

            msg_type = data.get("type", "")
            request_id = data.get("request_id")

            handler = MESSAGE_HANDLERS.get(msg_type)

            if handler:
                task = asyncio.create_task(
                    _execute_handler(handler, data, websocket, msg_type, request_id)
                )
                handler_tasks.add(task)
                task.add_done_callback(handler_tasks.discard)
            else:
                logger.warning(f"[WebSocket Internal] Unknown message type: {msg_type}")
                if request_id:
                    await _safe_send(websocket, {
                        "type": "error",
                        "request_id": request_id,
                        "code": "UNKNOWN_MESSAGE_TYPE",
                        "message": f"Unknown message type: {msg_type}"
                    })

    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(receive_loop())
            tg.create_task(process_loop())

    except* WebSocketDisconnect:
        pass  # Normal disconnect
    except* asyncio.CancelledError:
        pass  # Task cancelled during shutdown
    except* (KeyboardInterrupt, SystemExit):
        pass  # Server shutdown
    except* Exception as eg:
        for exc in eg.exceptions:
            if not isinstance(exc, (WebSocketDisconnect, asyncio.CancelledError, KeyboardInterrupt, SystemExit)):
                logger.error(f"[WebSocket Internal] TaskGroup error: {exc}")
    finally:
        for task in list(handler_tasks):
            if not task.done():
                task.cancel()

        if handler_tasks:
            await asyncio.gather(*handler_tasks, return_exceptions=True)


@router.get("/ws/info")
async def websocket_info():
    """Get WebSocket connection info."""
    broadcaster = get_status_broadcaster()
    return {
        "endpoint": "/ws/status",
        "connected_clients": broadcaster.connection_count,
        "current_status": broadcaster.get_status(),
        "supported_message_types": list(MESSAGE_HANDLERS.keys())
    }
