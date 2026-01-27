"""Temporal activities for distributed node execution.

Uses class-based activity pattern recommended by Temporal docs for sharing
resources like aiohttp.ClientSession across activity invocations.

References:
- https://docs.temporal.io/develop/python/python-sdk-sync-vs-async
- https://docs.temporal.io/develop/python/core-application

Architecture:
- NodeExecutionActivities class holds shared aiohttp.ClientSession
- Session is passed via constructor, avoiding recreation per activity
- Each activity call gets its own WebSocket connection from the session pool
"""

from datetime import datetime
from typing import Any, Dict, Optional

import aiohttp
from temporalio import activity

from core.logging import get_logger
from core.config import Settings

logger = get_logger(__name__)

# Load settings to get the correct server port
_settings = Settings()
MACHINA_URL = f"http://{_settings.host}:{_settings.port}"
WS_URL = f"ws://{_settings.host}:{_settings.port}/ws/internal"

print(f"[Temporal Activities] MACHINA_URL configured: {MACHINA_URL}")
print(f"[Temporal Activities] WS_URL configured: {WS_URL}")


class NodeExecutionActivities:
    """Activity class for node execution with shared aiohttp session.

    Following Temporal's recommended pattern for dependency injection:
    - aiohttp.ClientSession is passed via constructor
    - Session provides connection pooling for concurrent activities
    - Each activity call gets its own WebSocket connection from the pool

    Reference: https://docs.temporal.io/develop/python/python-sdk-sync-vs-async
    """

    def __init__(self, session: aiohttp.ClientSession):
        """Initialize with shared aiohttp session.

        Args:
            session: aiohttp.ClientSession with connection pooling configured
        """
        self.session = session
        self.ws_url = WS_URL
        self.http_url = f"{MACHINA_URL}/api/workflow/node/execute"
        self.broadcast_url = f"{MACHINA_URL}/api/workflow/broadcast-status"

    @activity.defn
    async def execute_node_activity(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single workflow node with isolated context.

        This activity can run on ANY worker in the cluster, enabling
        horizontal scaling and multi-tenant distribution.

        Each node execution is independent - if it fails, Temporal will retry
        on the same or different worker without affecting other nodes.

        Args:
            context: Immutable context containing:
                - node_id: Unique node identifier
                - node_type: Type of node (aiAgent, console, timer, etc.)
                - node_data: Node configuration from React Flow
                - inputs: Outputs from upstream nodes (dependencies)
                - workflow_id: Parent workflow ID for tracking
                - tenant_id: Tenant identifier for multi-tenancy
                - session_id: Session identifier
                - nodes: Full node list (for tool/memory detection by handlers)
                - edges: Full edge list (for tool/memory detection by handlers)

        Returns:
            Dict with success, result, node_id, and metadata
        """
        node_id = context["node_id"]
        node_type = context["node_type"]
        node_data = context.get("node_data", {})
        workflow_id = context.get("workflow_id")
        tenant_id = context.get("tenant_id")

        activity.logger.info(
            f"Executing node activity: {node_id} ({node_type})",
            extra={"tenant_id": tenant_id, "workflow_id": workflow_id},
        )
        print(f"[Activity] Starting node: {node_id} (type={node_type})")

        # Heartbeat at start to signal activity is alive
        activity.heartbeat(f"Starting {node_type}: {node_id}")

        # Handle pre-executed trigger nodes (already have their output)
        if context.get("pre_executed"):
            print(f"[Activity] Node {node_id} is pre-executed, returning cached result")
            result = {
                "success": True,
                "node_id": node_id,
                "node_type": node_type,
                "result": context.get("trigger_output", {}),
                "pre_executed": True,
                "timestamp": datetime.now().isoformat(),
            }
            await self._broadcast_status(node_id, "success", result, workflow_id)
            return result

        # Handle disabled nodes
        if node_data.get("disabled"):
            print(f"[Activity] Node {node_id} is disabled, skipping")
            result = {
                "success": True,
                "node_id": node_id,
                "node_type": node_type,
                "skipped": True,
                "reason": "disabled",
                "timestamp": datetime.now().isoformat(),
            }
            await self._broadcast_status(node_id, "skipped", {"disabled": True}, workflow_id)
            return result

        # Broadcast "executing" status for UI updates
        await self._broadcast_status(
            node_id=node_id,
            status="executing",
            data={"node_type": node_type},
            workflow_id=workflow_id,
        )

        try:
            # Heartbeat before potentially long WebSocket operation
            activity.heartbeat(f"Executing via WebSocket: {node_id}")

            # Execute node via WebSocket (each call gets own connection from pool)
            result = await self._execute_via_websocket(context)

            # Add metadata
            result["node_id"] = node_id
            result["node_type"] = node_type
            result["timestamp"] = datetime.now().isoformat()

            # Broadcast result status
            if result.get("success"):
                await self._broadcast_status(
                    node_id=node_id,
                    status="success",
                    data={
                        "result": result.get("result"),
                        "execution_time": result.get("execution_time"),
                    },
                    workflow_id=workflow_id,
                )
                print(f"[Activity] Node {node_id} completed successfully")
            else:
                await self._broadcast_status(
                    node_id=node_id,
                    status="error",
                    data={"error": result.get("error")},
                    workflow_id=workflow_id,
                )
                print(f"[Activity] Node {node_id} failed: {result.get('error')}")

            # Heartbeat for activity liveness
            activity.heartbeat(f"Node {node_id} completed")

            return result

        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            logger.error(f"Node {node_id} execution failed: {error_msg}")
            print(f"[Activity] Node {node_id} EXCEPTION: {error_msg}")

            # Broadcast error status
            await self._broadcast_status(
                node_id=node_id,
                status="error",
                data={"error": error_msg},
                workflow_id=workflow_id,
            )

            # Raise to trigger Temporal retry mechanism
            raise

    async def _execute_via_websocket(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute node via WebSocket using shared session's connection pool.

        Each call creates a new WebSocket connection from the session's pool,
        avoiding race conditions when multiple activities run concurrently.
        """
        import json
        import uuid

        node_id = context["node_id"]
        node_type = context["node_type"]
        request_id = str(uuid.uuid4())

        message = {
            "type": "execute_node",
            "request_id": request_id,
            "node_id": node_id,
            "node_type": node_type,
            "parameters": context.get("node_data", {}),
            "nodes": context.get("nodes", []),
            "edges": context.get("edges", []),
            "session_id": context.get("session_id", "default"),
            "workflow_id": context.get("workflow_id"),
        }

        print(f"[Activity] WebSocket execute for {node_id}")

        try:
            # Each activity gets its own WebSocket connection from the pool
            async with self.session.ws_connect(
                self.ws_url,
                heartbeat=20,
                receive_timeout=120,
            ) as ws:
                await ws.send_json(message)
                print(f"[Activity] Sent request for {node_id}")

                # Wait for response with matching request_id
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        response = json.loads(msg.data)
                        if response.get("request_id") == request_id:
                            print(f"[Activity] Got response for {node_id}: success={response.get('success')}")
                            return response
                    elif msg.type == aiohttp.WSMsgType.ERROR:
                        raise Exception(f"WebSocket error: {ws.exception()}")
                    elif msg.type == aiohttp.WSMsgType.CLOSED:
                        raise Exception("WebSocket closed unexpectedly")

                raise Exception(f"No response for request {request_id}")

        except aiohttp.ClientError as e:
            raise Exception(f"WebSocket connection error: {e}")

    async def _broadcast_status(
        self,
        node_id: str,
        status: str,
        data: dict,
        workflow_id: str = None,
    ) -> None:
        """Broadcast node status for real-time UI updates.

        Non-fatal - execution continues even if broadcast fails.
        """
        try:
            async with self.session.post(
                self.broadcast_url,
                json={
                    "node_id": node_id,
                    "status": status,
                    "data": data or {},
                    "workflow_id": workflow_id,
                },
                timeout=aiohttp.ClientTimeout(total=5),
            ) as response:
                if response.status == 200:
                    print(f"[Activity] Broadcast: {node_id} -> {status}")
        except Exception as e:
            # Non-fatal - don't fail execution if broadcast fails
            logger.warning(f"Broadcast failed for {node_id}: {e}")
            print(f"[Activity] Broadcast failed (non-fatal): {e}")


# =============================================================================
# Factory function for creating activity instance with session
# =============================================================================

def create_node_activities(session: aiohttp.ClientSession) -> NodeExecutionActivities:
    """Factory function to create activity instance with shared session.

    This follows Temporal's recommended pattern for dependency injection.
    The session should be created once when the worker starts and reused.

    Args:
        session: aiohttp.ClientSession with connection pooling

    Returns:
        NodeExecutionActivities instance ready for worker registration
    """
    return NodeExecutionActivities(session)


async def create_shared_session(pool_size: int = 100) -> aiohttp.ClientSession:
    """Create a shared aiohttp session with connection pooling.

    Args:
        pool_size: Maximum number of concurrent connections

    Returns:
        Configured aiohttp.ClientSession
    """
    connector = aiohttp.TCPConnector(
        limit=pool_size,
        limit_per_host=pool_size,
        enable_cleanup_closed=True,
    )
    timeout = aiohttp.ClientTimeout(
        total=300,  # 5 min total
        connect=10,  # 10 sec connect
    )
    session = aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
    )
    print(f"[Activities] Created shared session with pool_size={pool_size}")
    return session


# =============================================================================
# Standalone activity function (for backwards compatibility)
# =============================================================================

# Global session for standalone function
_global_session: Optional[aiohttp.ClientSession] = None
_global_activities: Optional[NodeExecutionActivities] = None


async def _get_global_activities() -> NodeExecutionActivities:
    """Get or create global activities instance."""
    global _global_session, _global_activities

    if _global_session is None or _global_session.closed:
        _global_session = await create_shared_session()
        _global_activities = NodeExecutionActivities(_global_session)

    return _global_activities


@activity.defn
async def execute_node_activity(context: Dict[str, Any]) -> Dict[str, Any]:
    """Standalone activity function for backwards compatibility.

    For new code, use NodeExecutionActivities class with shared session.
    """
    activities = await _get_global_activities()
    return await activities.execute_node_activity(context)
