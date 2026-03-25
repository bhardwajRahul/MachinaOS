"""Temporal client wrapper for MachinaOs.

Manages the Temporal client connection lifecycle with retry support.
"""

import asyncio
from typing import Optional
from temporalio.api.workflowservice.v1 import DescribeNamespaceRequest
from temporalio.client import Client
from temporalio.runtime import LoggingConfig, Runtime, TelemetryConfig

from core.logging import get_logger

logger = get_logger(__name__)


class TemporalClientWrapper:
    """Wrapper around Temporal client for lifecycle management."""

    def __init__(self, server_address: str, namespace: str = "default"):
        self.server_address = server_address
        self.namespace = namespace
        self._client: Optional[Client] = None
        self._runtime: Optional[Runtime] = None
        self._reconnect_task: Optional[asyncio.Task] = None

    @property
    def client(self) -> Optional[Client]:
        """Get the underlying Temporal client."""
        return self._client

    @property
    def is_connected(self) -> bool:
        """Check if client is connected."""
        return self._client is not None

    async def connect(self, retries: int = 3, delay: float = 2.0) -> Optional[Client]:
        """Connect to the Temporal server with retries.

        Returns:
            The connected Temporal client, or None if connection failed.
        """
        if self._client is not None:
            return self._client

        # Create runtime once (reusable across reconnects)
        if self._runtime is None:
            self._runtime = Runtime(
                telemetry=TelemetryConfig(
                    logging=LoggingConfig(filter="ERROR"),
                ),
                worker_heartbeat_interval=None,
            )

        for attempt in range(1, retries + 1):
            try:
                logger.info(
                    f"Connecting to Temporal server (attempt {attempt}/{retries})",
                    server_address=self.server_address,
                    namespace=self.namespace,
                )
                client = await Client.connect(
                    self.server_address,
                    namespace=self.namespace,
                    runtime=self._runtime,
                )
                # Verify namespace is ready (gRPC port may accept connections
                # before the server finishes registering namespaces)
                await client.service_client.workflow_service.describe_namespace(
                    DescribeNamespaceRequest(namespace=self.namespace)
                )
                self._client = client
                print(f"[Temporal] Connected to {self.server_address}", flush=True)
                logger.info("Connected to Temporal server")
                return self._client
            except Exception as e:
                print(f"[Temporal] Connection attempt {attempt}/{retries} failed: {e}", flush=True)
                logger.warning(
                    f"Temporal connection attempt {attempt}/{retries} failed: {e}"
                )
                if attempt < retries:
                    await asyncio.sleep(delay)

        print(f"[Temporal] Failed to connect after {retries} attempts", flush=True)
        logger.error(
            f"Failed to connect to Temporal server at {self.server_address} after {retries} attempts"
        )
        return None

    async def start_background_reconnect(self, interval: float = 30.0) -> None:
        """Start a background task that periodically tries to reconnect."""
        if self._reconnect_task is not None:
            return

        async def _reconnect_loop():
            while True:
                await asyncio.sleep(interval)
                if self._client is not None:
                    continue
                logger.info("Attempting Temporal reconnect...")
                client = await self.connect(retries=1, delay=0)
                if client:
                    logger.info("Temporal reconnected successfully")
                    break

        self._reconnect_task = asyncio.create_task(_reconnect_loop())

    async def disconnect(self) -> None:
        """Disconnect from the Temporal server."""
        if self._reconnect_task is not None:
            self._reconnect_task.cancel()
            self._reconnect_task = None
        if self._client is not None:
            self._client = None
            logger.info("Disconnected from Temporal server")
