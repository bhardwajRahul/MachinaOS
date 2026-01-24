"""Temporal client wrapper for MachinaOs.

Manages the Temporal client connection lifecycle.
"""

from typing import Optional
from temporalio.client import Client
from temporalio.runtime import Runtime, TelemetryConfig

from core.logging import get_logger

logger = get_logger(__name__)


class TemporalClientWrapper:
    """Wrapper around Temporal client for lifecycle management."""

    def __init__(self, server_address: str, namespace: str = "default"):
        """Initialize the client wrapper.

        Args:
            server_address: Temporal server address (e.g., "localhost:7233")
            namespace: Temporal namespace to use
        """
        self.server_address = server_address
        self.namespace = namespace
        self._client: Optional[Client] = None
        self._runtime: Optional[Runtime] = None

    @property
    def client(self) -> Optional[Client]:
        """Get the underlying Temporal client."""
        return self._client

    @property
    def is_connected(self) -> bool:
        """Check if client is connected."""
        return self._client is not None

    async def connect(self) -> Client:
        """Connect to the Temporal server.

        Returns:
            The connected Temporal client
        """
        if self._client is not None:
            return self._client

        logger.info(
            "Connecting to Temporal server",
            server_address=self.server_address,
            namespace=self.namespace,
        )

        # Create runtime with worker heartbeating disabled to avoid warning on older servers
        self._runtime = Runtime(
            telemetry=TelemetryConfig(),
            worker_heartbeat_interval=None,
        )

        self._client = await Client.connect(
            self.server_address,
            namespace=self.namespace,
            runtime=self._runtime,
        )

        logger.info("Connected to Temporal server")
        return self._client

    async def disconnect(self) -> None:
        """Disconnect from the Temporal server."""
        if self._client is not None:
            # Temporal client doesn't have an explicit close method,
            # but we clear the reference
            self._client = None
            logger.info("Disconnected from Temporal server")
