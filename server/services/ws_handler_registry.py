"""Plugin self-registration registries.

Two sibling concerns share this file because they're the same pattern
(idempotent dict + collision check) for the same audience (plugin
``__init__.py`` modules wiring themselves into the framework):

1. **WebSocket handlers** — ``register_ws_handlers({type: handler})``
   for side-channel commands like ``telegram_connect``,
   ``whatsapp_status``. Read by ``routers/websocket.py`` at dispatch
   time and merged into ``MESSAGE_HANDLERS``.

2. **HTTP routers** — ``register_router(APIRouter, name="<plugin>")``
   for plugin-owned routes (OAuth callbacks, webhook receivers,
   direct-API endpoints). Read by ``server.main`` after plugin discovery
   and ``app.include_router(...)``'d.

No hardcoded plugin names anywhere in the central router or main.py.
Adding a new plugin's WS / HTTP surface is one registration call inside
that plugin's package.
"""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Dict, List

from fastapi import APIRouter, WebSocket

from services.plugin.registry import IdempotentRegistry

logger = logging.getLogger(__name__)

WSHandler = Callable[[Dict[str, Any], WebSocket], Awaitable[Dict[str, Any]]]

_WS_REGISTRY: IdempotentRegistry[str, WSHandler] = IdempotentRegistry("ws_handler")
_ROUTER_REGISTRY: IdempotentRegistry[str, APIRouter] = IdempotentRegistry("router")


# ---- WebSocket handlers --------------------------------------------------

def register_ws_handlers(handlers: Dict[str, WSHandler]) -> None:
    """Publish a batch of ``message_type -> handler`` mappings.

    Idempotent on re-import (same callable for the same key is a no-op).
    Registering a different callable for an existing key raises
    ``ValueError`` to surface plugin namespace collisions early.
    """
    for msg_type, handler in handlers.items():
        _WS_REGISTRY.register(msg_type, handler)


def get_ws_handlers() -> Dict[str, WSHandler]:
    """Snapshot of all plugin-registered WS handlers.

    Returns a fresh dict so callers can mutate without affecting the
    registry (e.g. ``MESSAGE_HANDLERS = {**core, **get_ws_handlers()}``).
    """
    return dict(_WS_REGISTRY.items())


def list_registered_types() -> list[str]:
    """For diagnostics / startup logging."""
    return sorted(_WS_REGISTRY.keys())


# ---- HTTP routers --------------------------------------------------------

def register_router(router: APIRouter, *, name: str) -> None:
    """Publish a plugin-owned ``APIRouter`` for inclusion at app startup.

    ``name`` is the plugin folder name — used for diagnostics and
    collision detection. Same idempotency contract as the WS side: the
    same router for the same name is a no-op; a different router for an
    existing name raises ``ValueError`` so plugin-name collisions fail
    at import time, not request time.
    """
    _ROUTER_REGISTRY.register(name, router)


def get_routers() -> List[APIRouter]:
    """Snapshot of registered routers in registration order."""
    return _ROUTER_REGISTRY.values()


def list_registered_routers() -> List[str]:
    """For diagnostics / startup logging."""
    return sorted(_ROUTER_REGISTRY.keys())
