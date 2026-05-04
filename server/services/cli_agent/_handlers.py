"""WebSocket handlers for the CLI agent framework.

Self-registered into ``services.ws_handler_registry`` from
``services/cli_agent/__init__.py``. The router does not import this
module directly — it discovers handlers via the registry at dispatch
time, mirroring the telegram / whatsapp plugin pattern.

Two generic handlers (one pair total — dispatched by the ``provider``
field):

- ``cli_login``        → spawns ``<provider> login``
- ``cli_auth_status``  → probes whether the CLI is logged in

Both replace what would have been per-provider OAuth handlers
(``codex_oauth_login`` etc.).
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict

from fastapi import WebSocket

from services.cli_agent.cli_auth import check_auth, run_native_login


async def handle_cli_login(
    data: Dict[str, Any],
    websocket: WebSocket,  # noqa: ARG001 — registry signature
) -> Dict[str, Any]:
    """Trigger the CLI's native login flow.

    Payload: ``{provider: "claude" | "codex" | "gemini"}``.
    The CLI handles its own credential storage; we only spawn the flow.
    """
    provider = (data.get("provider") or "").strip().lower()
    if not provider:
        return {"success": False, "error": "missing 'provider' field"}
    return await run_native_login(provider)


async def handle_cli_auth_status(
    data: Dict[str, Any],
    websocket: WebSocket,  # noqa: ARG001 — registry signature
) -> Dict[str, Any]:
    """Check whether the CLI is logged in.

    Payload: ``{provider: "claude" | "codex" | "gemini"}``.
    Returns ``{logged_in, available, hint, exit_code, error}``.
    """
    provider = (data.get("provider") or "").strip().lower()
    if not provider:
        return {
            "logged_in": False, "available": False,
            "error": "missing 'provider' field",
        }
    return await check_auth(provider)


# Registry payload — `services/cli_agent/__init__.py` registers these
# into `services.ws_handler_registry` on package import.
WSHandler = Callable[[Dict[str, Any], WebSocket], Awaitable[Dict[str, Any]]]

WS_HANDLERS: Dict[str, WSHandler] = {
    "cli_login": handle_cli_login,
    "cli_auth_status": handle_cli_auth_status,
}
