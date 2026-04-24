"""Node allowlist service.

Reads server/config/node_allowlist.json and decides whether the frontend
Component Palette should show all nodes or filter by an explicit list.

Default-on: if the file is missing, malformed, or has an empty list, all
nodes are shown.
"""

import json
from pathlib import Path
from typing import Any, Dict, List

from core.logging import get_logger

logger = get_logger(__name__)

CONFIG_PATH = Path(__file__).parent.parent / "config" / "node_allowlist.json"


class NodeAllowlistService:
    """Resolves the palette visibility config from node_allowlist.json."""

    def __init__(self, config_path: Path = CONFIG_PATH) -> None:
        self._config_path = config_path

    def get_config(self) -> Dict[str, Any]:
        """Return the effective allowlist config.

        Response shape:
            show_all: bool
                true  -> do not filter the palette; every node is visible.
                false -> show only node types listed in enabled_nodes.
            enabled_nodes: list[str]
                Only meaningful when show_all is false.
        """
        if not self._config_path.exists():
            return {"show_all": True, "enabled_nodes": []}

        try:
            with self._config_path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception as e:
            logger.warning("Failed to parse node_allowlist.json, falling back to show_all: %s", e)
            return {"show_all": True, "enabled_nodes": []}

        enabled_nodes = raw.get("enabled_nodes", [])
        if not isinstance(enabled_nodes, list):
            logger.warning("node_allowlist.json 'enabled_nodes' is not a list, falling back to show_all")
            return {"show_all": True, "enabled_nodes": []}

        enabled_nodes = [n for n in enabled_nodes if isinstance(n, str)]

        if len(enabled_nodes) == 0:
            return {"show_all": True, "enabled_nodes": []}

        return {"show_all": False, "enabled_nodes": enabled_nodes}


_instance: NodeAllowlistService | None = None


def get_node_allowlist_service() -> NodeAllowlistService:
    """Return the singleton NodeAllowlistService."""
    global _instance
    if _instance is None:
        _instance = NodeAllowlistService()
    return _instance
