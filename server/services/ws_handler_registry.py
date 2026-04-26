"""WebSocket handler registry for plugin-owned messages.

Mirrors the pattern used by :data:`services.node_registry._HANDLER_REGISTRY`
(plugin nodes self-register via ``BaseNode.__init_subclass__``) but for
side-channel WebSocket commands like ``telegram_connect``,
``whatsapp_status``, etc.

Each ``nodes/<group>/__init__.py`` calls :func:`register_ws_handlers`
with a dict of ``message_type -> async handler``; the central WebSocket
router reads :func:`get_ws_handlers` at dispatch time and merges the
result into its own legacy ``MESSAGE_HANDLERS`` table.

No hardcoded plugin names anywhere in the router.  Adding a new
plugin's WS surface is a one-line registration call inside that
plugin's package.
"""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)

WSHandler = Callable[[Dict[str, Any], WebSocket], Awaitable[Dict[str, Any]]]

_REGISTRY: Dict[str, WSHandler] = {}


def register_ws_handlers(handlers: Dict[str, WSHandler]) -> None:
    """Publish a batch of ``message_type -> handler`` mappings.

    Idempotent on re-import (same callable for the same key is a no-op).
    Registering a different callable for an existing key raises
    ``ValueError`` to surface plugin namespace collisions early.
    """
    for msg_type, handler in handlers.items():
        existing = _REGISTRY.get(msg_type)
        if existing is not None and existing is not handler:
            raise ValueError(
                f"WS handler for message_type '{msg_type}' is already registered "
                f"by {existing.__module__}.{existing.__qualname__}; refusing to "
                f"overwrite with {handler.__module__}.{handler.__qualname__}"
            )
        _REGISTRY[msg_type] = handler


def get_ws_handlers() -> Dict[str, WSHandler]:
    """Snapshot of all plugin-registered WS handlers.

    Returns a fresh dict so callers can mutate without affecting the
    registry (e.g. ``MESSAGE_HANDLERS = {**core, **get_ws_handlers()}``).
    """
    return dict(_REGISTRY)


def list_registered_types() -> list[str]:
    """For diagnostics / startup logging."""
    return sorted(_REGISTRY.keys())
