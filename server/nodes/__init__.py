"""Per-node plugin modules (Wave 10.C).

Each ``.py`` file in this package registers one node (or a family of
closely related nodes) via ``services.node_registry.register_node``. We
walk the package at import time so every module's ``register_node(...)``
call runs before the FastAPI app starts serving NodeSpec endpoints.

To add a new node, create ``server/nodes/<name>.py`` with:

    from typing import Literal
    from pydantic import Field
    from models.nodes import BaseNodeParams
    from services.node_registry import register_node

    class MyParams(BaseNodeParams):
        type: Literal["myNode"]
        query: str = Field(default="", json_schema_extra={"placeholder": "Search..."})

    async def handle_my_node(node_id, node_type, params, context):
        return {"success": True, "result": {...}}

    register_node(
        type="myNode",
        metadata={
            "displayName": "My Node",
            "icon": "asset:my_icon",
            "group": ["tool"],
            "color": "#8be9fd",
            "componentKind": "square",
            "handles": [
                {"name": "input-main",  "kind": "input",  "position": "left",  "role": "main"},
                {"name": "output-main", "kind": "output", "position": "right", "role": "main"},
            ],
            "description": "...",
            "version": 1,
        },
        input_model=MyParams,
        handler=handle_my_node,
    )

Zero edits required in any other file. The node appears in the editor
at the next backend restart.
"""

from __future__ import annotations

import importlib
import logging
import pkgutil

logger = logging.getLogger(__name__)


def _discover() -> list[str]:
    """Import every submodule so its ``register_node`` side effect runs.
    Returns the list of module names imported, for logging."""
    imported: list[str] = []
    for module_info in pkgutil.iter_modules(__path__):
        name = module_info.name
        if name.startswith("_"):
            continue
        full_name = f"{__name__}.{name}"
        try:
            importlib.import_module(full_name)
            imported.append(name)
        except Exception:
            logger.exception("Failed to import node plugin %s", full_name)
    return imported


_DISCOVERED = _discover()
logger.info("node plugins loaded: %s", _DISCOVERED or "(none yet)")
