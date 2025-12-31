"""WebSocket Status Broadcaster Service.

Manages WebSocket connections and broadcasts status updates to all connected clients.
Supports all node types, variable updates, and workflow state changes.
"""

import asyncio
import json
import orjson
from typing import Set, Dict, Any, Optional, List
from fastapi import WebSocket
from core.logging import get_logger

logger = get_logger(__name__)


class StatusBroadcaster:
    """Manages WebSocket connections and broadcasts status updates."""

    def __init__(self):
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

        # Current state for all status types
        self._status: Dict[str, Any] = {
            "android": {
                "connected": False,
                "paired": False,
                "device_id": None,
                "device_name": None,
                "connected_devices": [],
                "connection_type": None,
                "qr_data": None,
                "session_token": None
            },
            "whatsapp": {
                "connected": False,
                "has_session": False,
                "running": False,
                "pairing": False,
                "device_id": None,
                "qr": None
            },
            "api_keys": {},  # provider -> validation status
            "nodes": {},  # node_id -> node status
            "variables": {},  # variable_name -> value
            "workflow": {
                "executing": False,
                "current_node": None
            },
            "workflow_lock": {
                "locked": False,
                "workflow_id": None,
                "locked_at": None,
                "reason": None
            },
            "deployment": {
                "isRunning": False,
                "activeRuns": 0,
                "status": "idle",
                "workflow_id": None
            }
        }

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        logger.info(f"[StatusBroadcaster] Client connected. Total: {len(self._connections)}")

        # Send current full status immediately
        try:
            await websocket.send_json({
                "type": "initial_status",
                "data": self._status
            })
        except Exception as e:
            logger.error(f"[StatusBroadcaster] Failed to send initial status: {e}")

    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        async with self._lock:
            self._connections.discard(websocket)
        logger.info(f"[StatusBroadcaster] Client disconnected. Total: {len(self._connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients using TaskGroup.

        Uses asyncio.TaskGroup (Python 3.11+) for structured concurrency:
        - All tasks complete or cancel together
        - Proper exception handling via ExceptionGroup
        """
        if not self._connections:
            return

        # Get connections list while holding lock
        async with self._lock:
            connections_list = list(self._connections)

        if not connections_list:
            return

        message_bytes = orjson.dumps(message).decode()
        disconnected: set[WebSocket] = set()

        async def send_to_client(connection: WebSocket):
            """Send message to a single client."""
            try:
                await connection.send_text(message_bytes)
            except Exception as e:
                logger.warning(f"[StatusBroadcaster] Send failed: {e}")
                disconnected.add(connection)

        # Execute all sends concurrently with TaskGroup
        try:
            async with asyncio.TaskGroup() as tg:
                for conn in connections_list:
                    tg.create_task(send_to_client(conn))
        except* Exception as eg:
            # TaskGroup aggregates exceptions - log them but continue
            for exc in eg.exceptions:
                logger.warning(f"[StatusBroadcaster] TaskGroup exception: {exc}")

        # Remove failed connections
        if disconnected:
            async with self._lock:
                self._connections -= disconnected

    # =========================================================================
    # API Key Validation Status Updates
    # =========================================================================

    async def update_api_key_status(
        self,
        provider: str,
        valid: bool,
        message: Optional[str] = None,
        has_key: bool = True,
        models: Optional[List[str]] = None
    ):
        """Update API key validation status and broadcast."""
        self._status["api_keys"][provider] = {
            "valid": valid,
            "hasKey": has_key,
            "message": message,
            "models": models or [],
            "timestamp": asyncio.get_event_loop().time()
        }

        await self.broadcast({
            "type": "api_key_status",
            "provider": provider,
            "data": self._status["api_keys"][provider]
        })

    def get_api_key_status(self, provider: str) -> Optional[Dict[str, Any]]:
        """Get API key validation status for a provider."""
        return self._status["api_keys"].get(provider)

    # =========================================================================
    # Android Status Updates
    # =========================================================================

    async def update_android_status(
        self,
        connected: bool,
        paired: bool = False,
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
        connected_devices: Optional[List[str]] = None,
        connection_type: Optional[str] = None,
        qr_data: Optional[str] = None,
        session_token: Optional[str] = None
    ):
        """Update Android relay connection status and broadcast."""
        self._status["android"] = {
            "connected": connected,
            "paired": paired,
            "device_id": device_id,
            "device_name": device_name,
            "connected_devices": connected_devices or [],
            "connection_type": connection_type,
            "qr_data": qr_data,
            "session_token": session_token
        }

        await self.broadcast({
            "type": "android_status",
            "data": self._status["android"]
        })

    # =========================================================================
    # WhatsApp Status Updates
    # =========================================================================

    async def update_whatsapp_status(
        self,
        connected: bool,
        has_session: bool = False,
        running: bool = False,
        pairing: bool = False,
        device_id: Optional[str] = None,
        qr: Optional[str] = None
    ):
        """Update WhatsApp connection status and broadcast."""
        import time
        self._status["whatsapp"] = {
            "connected": connected,
            "has_session": has_session,
            "running": running,
            "pairing": pairing,
            "device_id": device_id,
            "qr": qr,
            "timestamp": time.time()
        }

        await self.broadcast({
            "type": "whatsapp_status",
            "data": self._status["whatsapp"]
        })

    def get_whatsapp_status(self) -> Dict[str, Any]:
        """Get WhatsApp connection status."""
        return self._status["whatsapp"].copy()

    # =========================================================================
    # Node Status Updates
    # =========================================================================

    async def update_node_status(
        self,
        node_id: str,
        status: str,  # "idle", "executing", "waiting", "success", "error"
        data: Optional[Dict[str, Any]] = None,
        workflow_id: Optional[str] = None
    ):
        """Update a specific node's status and broadcast.

        Args:
            node_id: The node ID
            status: Status string
            data: Optional status data
            workflow_id: Optional workflow ID to scope the status update (n8n pattern)
        """
        print(f"[BROADCAST] update_node_status: node={node_id}, status={status}, workflow={workflow_id}, connections={len(self._connections)}")
        self._status["nodes"][node_id] = {
            "status": status,
            "data": data or {},
            "timestamp": asyncio.get_event_loop().time(),
            "workflow_id": workflow_id
        }

        await self.broadcast({
            "type": "node_status",
            "node_id": node_id,
            "workflow_id": workflow_id,
            "data": self._status["nodes"][node_id]
        })

    async def update_node_output(
        self,
        node_id: str,
        output: Any,
        workflow_id: Optional[str] = None
    ):
        """Update a node's output data and broadcast."""
        if node_id not in self._status["nodes"]:
            self._status["nodes"][node_id] = {"status": "idle", "data": {}}

        self._status["nodes"][node_id]["output"] = output
        if workflow_id:
            self._status["nodes"][node_id]["workflow_id"] = workflow_id

        await self.broadcast({
            "type": "node_output",
            "node_id": node_id,
            "workflow_id": workflow_id,
            "output": output
        })

    # =========================================================================
    # Variable Updates
    # =========================================================================

    async def update_variable(self, name: str, value: Any):
        """Update a workflow variable and broadcast."""
        self._status["variables"][name] = value

        await self.broadcast({
            "type": "variable_update",
            "name": name,
            "value": value
        })

    async def update_variables(self, variables: Dict[str, Any]):
        """Update multiple variables at once and broadcast."""
        self._status["variables"].update(variables)

        await self.broadcast({
            "type": "variables_update",
            "variables": variables
        })

    # =========================================================================
    # Workflow Status Updates
    # =========================================================================

    async def update_workflow_status(
        self,
        executing: bool,
        current_node: Optional[str] = None,
        progress: Optional[float] = None
    ):
        """Update workflow execution status and broadcast."""
        self._status["workflow"] = {
            "executing": executing,
            "current_node": current_node,
            "progress": progress
        }

        await self.broadcast({
            "type": "workflow_status",
            "data": self._status["workflow"]
        })

    async def update_deployment_status(
        self,
        is_running: bool,
        status: str = "idle",
        active_runs: int = 0,
        workflow_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """Update deployment status and broadcast.

        Follows n8n/Conductor pattern where deployment state is tracked centrally.
        See DESIGN.md for architecture details.

        Args:
            is_running: Whether deployment is active
            status: Current status (idle, starting, running, stopped, cancelled, error)
            active_runs: Number of concurrent execution runs
            workflow_id: The deployed workflow ID
            data: Optional additional data (e.g., run_id, trigger info)
            error: Optional error message if status is 'error'
        """
        self._status["deployment"] = {
            "isRunning": is_running,
            "activeRuns": active_runs,
            "status": status,
            "workflow_id": workflow_id
        }

        # Broadcast deployment_status message (matches frontend handler)
        await self.broadcast({
            "type": "deployment_status",
            "status": status,
            "workflow_id": workflow_id,
            "data": data,
            "error": error
        })

    # =========================================================================
    # Workflow Lock Management (Per-Workflow Locks - n8n pattern)
    # =========================================================================

    async def lock_workflow(
        self,
        workflow_id: str,
        reason: str = "deployment"
    ) -> bool:
        """Lock a specific workflow to prevent concurrent modifications.

        Per-workflow locking (n8n pattern): Each workflow has its own independent lock.
        Multiple workflows can be locked simultaneously.

        Args:
            workflow_id: The workflow ID to lock
            reason: Reason for locking (e.g., "deployment", "execution")

        Returns:
            True if lock acquired, False if THIS workflow is already locked
        """
        import time

        # Initialize workflow_locks if not present
        if "workflow_locks" not in self._status:
            self._status["workflow_locks"] = {}

        # Check if THIS workflow is already locked
        if workflow_id in self._status["workflow_locks"]:
            existing_lock = self._status["workflow_locks"][workflow_id]
            if existing_lock.get("locked"):
                logger.warning(
                    f"[WorkflowLock] Workflow {workflow_id} is already locked "
                    f"for {existing_lock.get('reason')}"
                )
                return False

        # Lock this specific workflow
        lock_info = {
            "locked": True,
            "workflow_id": workflow_id,
            "locked_at": time.time(),
            "reason": reason
        }
        self._status["workflow_locks"][workflow_id] = lock_info

        # Also update legacy single lock for backward compatibility
        self._status["workflow_lock"] = lock_info.copy()

        await self.broadcast({
            "type": "workflow_lock",
            "workflow_id": workflow_id,
            "data": lock_info
        })

        logger.info(f"[WorkflowLock] Locked workflow {workflow_id} for {reason}")
        return True

    async def unlock_workflow(self, workflow_id: str) -> bool:
        """Unlock a specific workflow after deployment/execution completes.

        Args:
            workflow_id: The workflow ID to unlock

        Returns:
            True if unlocked successfully
        """
        # Initialize workflow_locks if not present
        if "workflow_locks" not in self._status:
            self._status["workflow_locks"] = {}

        # Check if this workflow is locked
        if workflow_id not in self._status["workflow_locks"]:
            logger.debug(f"[WorkflowLock] Workflow {workflow_id} not locked")
            return True  # Already unlocked

        existing_lock = self._status["workflow_locks"].get(workflow_id, {})
        if not existing_lock.get("locked"):
            logger.debug(f"[WorkflowLock] Workflow {workflow_id} not locked")
            return True

        # Remove lock for this workflow
        del self._status["workflow_locks"][workflow_id]

        # Update legacy single lock if it was for this workflow
        if self._status["workflow_lock"].get("workflow_id") == workflow_id:
            self._status["workflow_lock"] = {
                "locked": False,
                "workflow_id": None,
                "locked_at": None,
                "reason": None
            }

        await self.broadcast({
            "type": "workflow_lock",
            "workflow_id": workflow_id,
            "data": {
                "locked": False,
                "workflow_id": workflow_id,
                "locked_at": None,
                "reason": None
            }
        })

        logger.info(f"[WorkflowLock] Unlocked workflow {workflow_id}")
        return True

    def is_workflow_locked(self, workflow_id: Optional[str] = None) -> bool:
        """Check if a specific workflow is locked.

        Args:
            workflow_id: Workflow ID to check. If None, checks if any workflow is locked.

        Returns:
            True if the specified workflow is locked (or any if workflow_id is None)
        """
        # Initialize workflow_locks if not present
        if "workflow_locks" not in self._status:
            self._status["workflow_locks"] = {}

        if workflow_id is None:
            # Check if ANY workflow is locked
            return any(
                lock.get("locked", False)
                for lock in self._status["workflow_locks"].values()
            )

        # Check specific workflow
        lock = self._status["workflow_locks"].get(workflow_id, {})
        return lock.get("locked", False)

    def get_workflow_lock(self, workflow_id: Optional[str] = None) -> Dict[str, Any]:
        """Get workflow lock status.

        Args:
            workflow_id: Specific workflow to check. If None, returns legacy single lock.

        Returns:
            Lock info for the specified workflow or legacy lock
        """
        if workflow_id:
            # Initialize workflow_locks if not present
            if "workflow_locks" not in self._status:
                self._status["workflow_locks"] = {}

            lock = self._status["workflow_locks"].get(workflow_id, {})
            return {
                "locked": lock.get("locked", False),
                "workflow_id": workflow_id,
                "locked_at": lock.get("locked_at"),
                "reason": lock.get("reason")
            }

        # Return legacy single lock for backward compatibility
        return self._status["workflow_lock"].copy()

    def get_all_workflow_locks(self) -> Dict[str, Dict[str, Any]]:
        """Get all active workflow locks."""
        if "workflow_locks" not in self._status:
            return {}
        return {
            wid: lock.copy()
            for wid, lock in self._status["workflow_locks"].items()
            if lock.get("locked")
        }

    # =========================================================================
    # Generic Updates
    # =========================================================================

    async def send_custom_event(self, event_type: str, data: Any):
        """Send a custom event to all connected clients AND dispatch to event waiters.

        Uses dispatch_async() directly since we're in an async context.
        The sync dispatch() is for thread contexts like APScheduler callbacks.
        See DESIGN.md section "Cross-Thread Event Dispatch" for pattern details.
        """
        # Broadcast to all WebSocket clients
        await self.broadcast({
            "type": event_type,
            "data": data
        })

        # Dispatch to event waiters (for trigger nodes)
        # Use dispatch_async directly - we're in async context
        try:
            from services import event_waiter
            event_data = data if isinstance(data, dict) else {"data": data}
            resolved_count = await event_waiter.dispatch_async(event_type, event_data)
            if resolved_count > 0:
                logger.info(f"[StatusBroadcaster] Event {event_type} resolved {resolved_count} waiters")
        except Exception as e:
            logger.error(f"[StatusBroadcaster] Failed to dispatch to event waiters: {e}")

    # =========================================================================
    # Getters
    # =========================================================================

    def get_status(self) -> Dict[str, Any]:
        """Get the full current status."""
        return self._status.copy()

    def get_android_status(self) -> Dict[str, Any]:
        """Get Android connection status."""
        return self._status["android"].copy()

    def get_node_status(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific node's status."""
        return self._status["nodes"].get(node_id)

    async def clear_node_status(self, node_id: str) -> bool:
        """Clear a node's status and output from the cache."""
        if node_id in self._status["nodes"]:
            del self._status["nodes"][node_id]
            logger.info(f"[StatusBroadcaster] Cleared node status: {node_id}")
            # Broadcast that node status was cleared
            await self.broadcast({
                "type": "node_status_cleared",
                "node_id": node_id
            })
            return True
        return False

    def get_variable(self, name: str) -> Any:
        """Get a variable value."""
        return self._status["variables"].get(name)

    @property
    def connection_count(self) -> int:
        """Get the number of active WebSocket connections."""
        return len(self._connections)


# Global singleton instance
_broadcaster: Optional[StatusBroadcaster] = None


def get_status_broadcaster() -> StatusBroadcaster:
    """Get or create the global StatusBroadcaster instance."""
    global _broadcaster
    if _broadcaster is None:
        _broadcaster = StatusBroadcaster()
    return _broadcaster
