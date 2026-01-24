"""Temporal worker for distributed node execution.

Uses class-based activities with shared aiohttp session for proper
connection pooling across concurrent activity executions.

The worker polls the task queue and executes:
- MachinaWorkflow: Orchestrates the graph, schedules node activities
- NodeExecutionActivities: Executes individual nodes with shared session

Multiple workers can be started on different machines for horizontal scaling.
Each node activity can execute on any available worker in the cluster.

References:
- https://docs.temporal.io/develop/python/python-sdk-sync-vs-async
- https://docs.temporal.io/develop/worker-performance
"""

import asyncio
from typing import Optional

import aiohttp
from temporalio.client import Client
from temporalio.runtime import Runtime, TelemetryConfig
from temporalio.worker import Worker

from core.logging import get_logger
from .workflow import MachinaWorkflow
print(f"[Worker Import] MachinaWorkflow loaded from: {MachinaWorkflow.__module__}")
from .activities import (
    NodeExecutionActivities,
    create_shared_session,
    execute_node_activity,
)

logger = get_logger(__name__)


def create_runtime() -> Runtime:
    """Create a Temporal runtime with worker heartbeating disabled.

    Disables the runtime-level worker heartbeating feature to avoid
    the warning on older Temporal server versions that don't support it.
    """
    return Runtime(
        telemetry=TelemetryConfig(),
        worker_heartbeat_interval=None,  # Disable runtime heartbeating
    )


class TemporalWorkerManager:
    """Manages the Temporal worker lifecycle with shared resources.

    Creates a shared aiohttp.ClientSession that is passed to the activity
    class, following Temporal's recommended dependency injection pattern.
    """

    def __init__(
        self,
        client: Client,
        task_queue: str = "machina-tasks",
        pool_size: int = 100,
    ):
        """Initialize the worker manager.

        Args:
            client: Connected Temporal client
            task_queue: Task queue name to poll
            pool_size: Connection pool size for aiohttp session
        """
        self.client = client
        self.task_queue = task_queue
        self.pool_size = pool_size
        self._worker: Optional[Worker] = None
        self._worker_task: Optional[asyncio.Task] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._activities: Optional[NodeExecutionActivities] = None

    @property
    def is_running(self) -> bool:
        """Check if the worker is running."""
        return self._worker_task is not None and not self._worker_task.done()

    async def start(self) -> None:
        """Start the Temporal worker in the background."""
        if self.is_running:
            logger.warning("Temporal worker already running")
            return

        # Create shared aiohttp session with connection pooling
        self._session = await create_shared_session(self.pool_size)

        # Create activity instance with shared session
        self._activities = NodeExecutionActivities(self._session)

        # Create worker with class-based activity
        # For class-based activities, pass the bound method (instance.method)
        self._worker = Worker(
            self.client,
            task_queue=self.task_queue,
            workflows=[MachinaWorkflow],
            activities=[self._activities.execute_node_activity],  # Pass bound method
            # Allow concurrent activity execution for parallel branches
            max_concurrent_activities=self.pool_size,
            max_concurrent_workflow_tasks=10,
        )

        logger.info(
            "Starting Temporal worker",
            task_queue=self.task_queue,
            pool_size=self.pool_size,
        )
        print(f"[Worker] Starting with pool_size={self.pool_size}")

        # Run worker in background task
        self._worker_task = asyncio.create_task(
            self._run_worker(),
            name="temporal-worker",
        )

    async def _run_worker(self) -> None:
        """Run the worker (background task)."""
        try:
            await self._worker.run()
        except asyncio.CancelledError:
            logger.info("Temporal worker cancelled")
        except Exception as e:
            logger.error(f"Temporal worker error: {str(e)}")
            raise

    async def stop(self) -> None:
        """Stop the Temporal worker and cleanup resources."""
        if not self.is_running:
            return

        logger.info("Stopping Temporal worker")

        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None

        # Close shared session
        if self._session and not self._session.closed:
            await self._session.close()
            print("[Worker] Closed shared session")

        self._worker = None
        self._session = None
        self._activities = None
        logger.info("Temporal worker stopped")


async def run_standalone_worker(
    server_address: str = "localhost:7233",
    namespace: str = "default",
    task_queue: str = "machina-tasks",
    pool_size: int = 100,
) -> None:
    """Run the Temporal worker as a standalone process.

    This can be used for running workers separately from the main server,
    enabling horizontal scaling across multiple machines.

    Example:
        # Start multiple workers for horizontal scaling
        python -m services.temporal.worker

    Args:
        server_address: Temporal server address
        namespace: Temporal namespace
        task_queue: Task queue to poll
        pool_size: Connection pool size
    """
    logger.info(
        "Starting standalone Temporal worker",
        server_address=server_address,
        namespace=namespace,
        task_queue=task_queue,
    )

    print(f"[Worker] Connecting to {server_address}")
    print(f"[Worker] Namespace: {namespace}")
    print(f"[Worker] Task Queue: {task_queue}")
    print(f"[Worker] Pool Size: {pool_size}")

    # Use custom runtime with heartbeating disabled to avoid warning on older servers
    runtime = create_runtime()
    client = await Client.connect(server_address, namespace=namespace, runtime=runtime)

    # Create shared session and activities
    session = await create_shared_session(pool_size)
    activities = NodeExecutionActivities(session)

    try:
        worker = Worker(
            client,
            task_queue=task_queue,
            workflows=[MachinaWorkflow],
            activities=[activities.execute_node_activity],  # Pass bound method
            max_concurrent_activities=pool_size,
            max_concurrent_workflow_tasks=10,
        )

        print("[Worker] Running. Press Ctrl+C to stop.")
        logger.info("Worker running. Press Ctrl+C to stop.")
        await worker.run()

    finally:
        # Cleanup session on shutdown
        if not session.closed:
            await session.close()
            print("[Worker] Session closed")


async def create_worker(
    client: Client,
    task_queue: str = "machina-tasks",
    session: Optional[aiohttp.ClientSession] = None,
) -> Worker:
    """Create a worker instance for use in tests or custom setups.

    Args:
        client: Connected Temporal client
        task_queue: Task queue name
        session: Optional shared aiohttp session (created if not provided)

    Returns:
        Configured Worker instance (not started)
    """
    if session is None:
        session = await create_shared_session()

    activities = NodeExecutionActivities(session)

    return Worker(
        client,
        task_queue=task_queue,
        workflows=[MachinaWorkflow],
        activities=[activities.execute_node_activity],  # Pass bound method
        max_concurrent_activities=100,
        max_concurrent_workflow_tasks=10,
    )


if __name__ == "__main__":
    # Allow running worker standalone
    # Usage: python -m services.temporal.worker
    asyncio.run(run_standalone_worker())
