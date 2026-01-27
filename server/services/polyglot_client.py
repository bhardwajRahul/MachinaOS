"""Polyglot Server Client - HTTP client for polyglot-server plugin registry."""

import aiohttp
from typing import Dict, Any, List, Optional

from core.logging import get_logger

logger = get_logger(__name__)


class PolyglotClient:
    """Client for polyglot-server plugin registry.

    Provides async HTTP methods to interact with the polyglot-server
    for plugin discovery, schema retrieval, and execution.
    """

    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url.rstrip("/")
        self._session: Optional[aiohttp.ClientSession] = None

    async def initialize(self) -> None:
        """Initialize the HTTP session."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self._session = aiohttp.ClientSession(timeout=timeout)
            logger.info("PolyglotClient initialized", base_url=self.base_url)

    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
            logger.info("PolyglotClient closed")

    async def _ensure_session(self) -> aiohttp.ClientSession:
        """Ensure session is initialized and return it."""
        if self._session is None or self._session.closed:
            await self.initialize()
        return self._session

    async def health_check(self) -> Dict[str, Any]:
        """Check polyglot-server health status."""
        session = await self._ensure_session()
        try:
            async with session.get(f"{self.base_url}/api/health") as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"status": "error", "code": resp.status}
        except aiohttp.ClientError as e:
            logger.warning("Polyglot health check failed", error=str(e))
            return {"status": "unreachable", "error": str(e)}

    async def list_plugins(self) -> List[Dict[str, Any]]:
        """List all available plugins from polyglot-server."""
        session = await self._ensure_session()
        try:
            async with session.get(f"{self.base_url}/api/plugins") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("plugins", [])
                logger.warning("Failed to list plugins", status=resp.status)
                return []
        except aiohttp.ClientError as e:
            logger.error("Failed to list plugins", error=str(e))
            return []

    async def get_plugin(self, name: str) -> Optional[Dict[str, Any]]:
        """Get details for a specific plugin."""
        session = await self._ensure_session()
        try:
            async with session.get(f"{self.base_url}/api/plugins/{name}") as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
        except aiohttp.ClientError as e:
            logger.error("Failed to get plugin", plugin=name, error=str(e))
            return None

    async def get_schema(self, plugin_name: str) -> Optional[Dict[str, Any]]:
        """Get plugin input/output schema for workflow node integration."""
        session = await self._ensure_session()
        try:
            async with session.get(
                f"{self.base_url}/api/plugins/{plugin_name}/schema"
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
        except aiohttp.ClientError as e:
            logger.error("Failed to get schema", plugin=plugin_name, error=str(e))
            return None

    async def execute(
        self,
        plugin_name: str,
        action: str = "default",
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Execute a plugin action.

        Args:
            plugin_name: Name of the plugin to execute
            action: Action to perform (default: "default")
            params: Optional parameters for the action

        Returns:
            Execution result with success status and result/error
        """
        session = await self._ensure_session()
        payload = {
            "action": action,
            "params": params or {},
        }

        try:
            async with session.post(
                f"{self.base_url}/api/plugins/{plugin_name}/execute",
                json=payload,
            ) as resp:
                result = await resp.json()
                if resp.status == 200:
                    return result
                return {
                    "success": False,
                    "error": result.get("error", f"HTTP {resp.status}"),
                }
        except aiohttp.ClientError as e:
            logger.error(
                "Plugin execution failed",
                plugin=plugin_name,
                action=action,
                error=str(e),
            )
            return {"success": False, "error": str(e)}

    async def list_categories(self) -> List[str]:
        """List available plugin categories."""
        session = await self._ensure_session()
        try:
            async with session.get(f"{self.base_url}/api/categories") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("categories", [])
                return []
        except aiohttp.ClientError as e:
            logger.error("Failed to list categories", error=str(e))
            return []


# Global client instance for simple usage
_client: Optional[PolyglotClient] = None


async def get_polyglot_client(base_url: str = "http://localhost:8080") -> PolyglotClient:
    """Get or create the global polyglot client instance."""
    global _client
    if _client is None:
        _client = PolyglotClient(base_url)
        await _client.initialize()
    return _client


async def close_polyglot_client() -> None:
    """Close the global polyglot client instance."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
