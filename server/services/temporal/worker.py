"""Temporal worker for MachinaOs.

The worker polls the task queue and executes workflows and activities.
It can be run as a standalone process or embedded in the main server.
"""

import asyncio
from typing import Optional

from temporalio.client import Client
from temporalio.worker import Worker

from core.logging import get_logger
from .workflow import MachinaWorkflow
from .activities import execute_workflow_with_continuous_scheduling

logger = get_logger(__name__)


class TemporalWorkerManager:
    """Manages the Temporal worker lifecycle."""

    def __init__(
        self,
        client: Client,
        task_queue: str = "machina-tasks",
    ):
        """Initialize the worker manager.

        Args:
            client: Connected Temporal client
            task_queue: Task queue name to poll
        """
        self.client = client
        self.task_queue = task_queue
        self._worker: Optional[Worker] = None
        self._worker_task: Optional[asyncio.Task] = None

    @property
    def is_running(self) -> bool:
        """Check if the worker is running."""
        return self._worker_task is not None and not self._worker_task.done()

    async def start(self) -> None:
        """Start the Temporal worker in the background."""
        if self.is_running:
            logger.warning("Temporal worker already running")
            return

        self._worker = Worker(
            self.client,
            task_queue=self.task_queue,
            workflows=[MachinaWorkflow],
            activities=[execute_workflow_with_continuous_scheduling],
        )

        logger.info(
            "Starting Temporal worker",
            task_queue=self.task_queue,
        )

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
        """Stop the Temporal worker."""
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

        self._worker = None
        logger.info("Temporal worker stopped")


async def run_standalone_worker(
    server_address: str = "localhost:7233",
    namespace: str = "default",
    task_queue: str = "machina-tasks",
) -> None:
    """Run the Temporal worker as a standalone process.

    This can be used for running workers separately from the main server.

    Args:
        server_address: Temporal server address
        namespace: Temporal namespace
        task_queue: Task queue to poll
    """
    logger.info(
        "Starting standalone Temporal worker",
        server_address=server_address,
        namespace=namespace,
        task_queue=task_queue,
    )

    client = await Client.connect(server_address, namespace=namespace)

    worker = Worker(
        client,
        task_queue=task_queue,
        workflows=[MachinaWorkflow],
        activities=[execute_workflow_with_continuous_scheduling],
    )

    logger.info("Worker running. Press Ctrl+C to stop.")
    await worker.run()


if __name__ == "__main__":
    # Allow running worker standalone
    asyncio.run(run_standalone_worker())
