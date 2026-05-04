"""WebSocket handlers for the CLI agent framework.

Self-registered into ``services.ws_handler_registry`` from
``services/cli_agent/__init__.py``. The router does not import this
module directly — it discovers handlers via the registry at dispatch
time, mirroring the telegram / whatsapp / stripe plugin pattern.

Adopted from `nodes/stripe/_handlers.py` (CLI-managed OAuth pattern):

  - On successful ``<provider> login``, write a synthetic ``"cli-managed"``
    marker OAuth token via ``auth_service.store_oauth_tokens()``. The
    catalogue handler's ``stored`` check (keyed off
    ``status_hook``) flips ``true`` automatically — the existing
    ``OAuthConnect.tsx`` primitive renders the modal as Connected.
  - Broadcast ``credential_catalogue_updated`` so the frontend
    invalidates its catalogue cache and re-fetches reactively.
  - No ``cli_auth_status`` handler — redundant once ``stored`` drives
    the modal.

Logout: drop the marker token + broadcast.

The actual subprocess spawning lives in ``cli_auth.run_native_login``.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict

from fastapi import WebSocket

from core.logging import get_logger
from services.cli_agent.cli_auth import run_native_login

logger = get_logger(__name__)


# Synthetic marker stored in `auth_service` after a successful CLI login,
# matching `nodes/stripe/_handlers.py:_MARKER_TOKEN`. Lets the catalogue's
# generic `stored` check flip without per-provider code in the catalogue
# handler.
_MARKER_TOKEN = "cli-managed"

# Maps `cli_login.provider` field values to the credential-catalogue
# provider keys that `auth_service` indexes its OAuth tokens under.
# Aligns with the `status_hook` field in `credential_providers.json`.
_PROVIDER_TO_CATALOGUE_KEY: Dict[str, str] = {
    "claude": "claude_code",
    "codex": "codex_cli",
    "gemini": "gemini_cli",
}


async def _mark_logged_in(catalogue_key: str) -> None:
    """Write the marker token via `auth_service.store_oauth_tokens()` —
    same plumbing Google / Twitter / Stripe use after their OAuth flow."""
    from core.container import container
    await container.auth_service().store_oauth_tokens(
        provider=catalogue_key,
        access_token=_MARKER_TOKEN,
        refresh_token=_MARKER_TOKEN,
    )


async def _mark_logged_out(catalogue_key: str) -> None:
    from core.container import container
    await container.auth_service().remove_oauth_tokens(catalogue_key)


async def _broadcast_catalogue_updated() -> None:
    """Generic catalogue-invalidation broadcast — same event the Stripe /
    Google / Twitter handlers fire. Frontend listens in
    ``WebSocketContext`` (``case 'credential_catalogue_updated'``) and
    re-fetches the catalogue."""
    from services.status_broadcaster import get_status_broadcaster
    await get_status_broadcaster().broadcast({"type": "credential_catalogue_updated"})


async def handle_cli_login(
    data: Dict[str, Any],
    websocket: WebSocket,  # noqa: ARG001 — registry signature
) -> Dict[str, Any]:
    """Trigger the CLI's native login flow.

    Payload: ``{provider: "claude" | "codex" | "gemini"}``.

    On success: write the marker token via ``auth_service`` (so the
    catalogue's ``stored`` flag flips) and broadcast
    ``credential_catalogue_updated`` so the modal refreshes reactively.

    The CLI itself stores its real credentials in ``~/.claude/``,
    ``~/.codex/``, ``~/.gemini/`` — we never touch them.
    """
    provider = (data.get("provider") or "").strip().lower()
    if not provider:
        return {"success": False, "error": "missing 'provider' field"}

    result = await run_native_login(provider)
    if result.get("success"):
        catalogue_key = _PROVIDER_TO_CATALOGUE_KEY.get(provider)
        if catalogue_key:
            try:
                await _mark_logged_in(catalogue_key)
                await _broadcast_catalogue_updated()
            except Exception as exc:
                # Login itself succeeded; failing to mark/broadcast is a
                # cosmetic/UI issue, not a user-visible login failure.
                logger.warning(
                    "[cli_login:%s] mark/broadcast failed: %s", provider, exc,
                )
    return result


async def handle_cli_logout(
    data: Dict[str, Any],
    websocket: WebSocket,  # noqa: ARG001 — registry signature
) -> Dict[str, Any]:
    """Drop the marker token + broadcast catalogue update.

    The actual CLI auth lives in the CLI's own ~/. config — the user
    can run ``<provider> logout`` themselves to drop it. We just clear
    our catalogue marker so the modal flips back to Disconnected.
    """
    provider = (data.get("provider") or "").strip().lower()
    if not provider:
        return {"success": False, "error": "missing 'provider' field"}

    catalogue_key = _PROVIDER_TO_CATALOGUE_KEY.get(provider)
    if not catalogue_key:
        return {"success": False, "error": f"unknown provider {provider!r}"}

    try:
        await _mark_logged_out(catalogue_key)
        await _broadcast_catalogue_updated()
    except Exception as exc:
        logger.warning("[cli_logout:%s] mark/broadcast failed: %s", provider, exc)
        return {"success": False, "error": str(exc)}
    return {"success": True}


# Registry payload — `services/cli_agent/__init__.py` registers these
# into `services.ws_handler_registry` on package import.
WSHandler = Callable[[Dict[str, Any], WebSocket], Awaitable[Dict[str, Any]]]

WS_HANDLERS: Dict[str, WSHandler] = {
    "cli_login": handle_cli_login,
    "cli_logout": handle_cli_logout,
}
