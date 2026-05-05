"""Per-provider WebSocket handlers for CLI-managed OAuth.

Self-registered into ``services.ws_handler_registry`` from
``services/cli_agent/__init__.py``.

Naming convention matches Twitter / Google / Stripe — each provider gets
its own message type (``claude_code_login`` / ``claude_code_logout`` /
``codex_cli_login`` / ``codex_cli_logout``). The frontend dispatches with
an empty payload (see ``OAuthConnect.tsx`` ->
``useCredentialPanel.oauthLogin`` -> ``sendRequest(config.ws!.login, {})``);
the handler name encodes which provider to spawn.

Claude flow uses the documented CLI subcommands from
https://code.claude.com/docs/en/cli-reference:

- ``claude auth login``  — opens the browser, writes credentials.
- ``claude auth status`` — exits 0 when logged in, 1 otherwise.
- ``claude auth logout`` — clears credentials.

We delegate to ``services.claude_oauth`` for the spawn + status checks.
After ``auth login`` returns the spawned PID, a background task polls
``claude auth status`` until it reports success, then writes the synthetic
``"cli-managed"`` marker via ``auth_service.store_oauth_tokens()`` and
broadcasts ``credential_catalogue_updated`` (Stripe pattern, see
``nodes/stripe/_handlers.py``).

Codex login is not yet wired (no ``codex_oauth.py`` yet); the handler
returns a graceful "not yet supported" error pointing the user at the
manual flow. Logout works for both providers — drops the catalogue marker.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable, Dict

from fastapi import WebSocket

from core.logging import get_logger

logger = get_logger(__name__)


# Synthetic marker stored in `auth_service` after a successful CLI login,
# matching `nodes/stripe/_handlers.py:_MARKER_TOKEN`. Lets the catalogue's
# generic `stored` check flip without per-provider code in the catalogue
# handler.
_MARKER_TOKEN = "cli-managed"

# How long the background finaliser polls for `claude auth status` before
# giving up (the user may simply close the browser tab).
_LOGIN_TIMEOUT_SECONDS = 600.0
_LOGIN_POLL_INTERVAL = 2.0


# ---------------------------------------------------------------------------
# Marker-token + catalogue broadcast (Stripe pattern)
# ---------------------------------------------------------------------------

async def _mark_logged_in(catalogue_key: str) -> None:
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
    from services.status_broadcaster import get_status_broadcaster
    await get_status_broadcaster().broadcast({"type": "credential_catalogue_updated"})


# ---------------------------------------------------------------------------
# Claude — `claude auth login` / `auth status` / `auth logout`
# ---------------------------------------------------------------------------

async def _wait_until_logged_in(timeout_seconds: float) -> bool:
    """Poll ``claude auth status`` until it reports success or we time out."""
    from services.claude_oauth import claude_auth_status

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if await claude_auth_status():
            return True
        await asyncio.sleep(_LOGIN_POLL_INTERVAL)
    return False


async def _finalize_claude_login() -> None:
    try:
        ok = await _wait_until_logged_in(_LOGIN_TIMEOUT_SECONDS)
        if ok:
            await _mark_logged_in("claude_code")
            await _broadcast_catalogue_updated()
            logger.info("[claude_code_login] marker written + broadcast fired")
        else:
            logger.warning(
                "[claude_code_login] timed out after %.0fs waiting for "
                "`claude auth status` to report success — modal stays Disconnected",
                _LOGIN_TIMEOUT_SECONDS,
            )
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # pragma: no cover — defensive
        logger.exception("[claude_code_login] finalize failed: %s", exc)


async def handle_claude_code_login(
    data: Dict[str, Any],  # noqa: ARG001 — frontend sends {}
    websocket: WebSocket,  # noqa: ARG001 — registry signature
) -> Dict[str, Any]:
    """Spawn ``claude auth login``; let the CLI open the user's browser."""
    from services.claude_oauth import claude_auth_status, initiate_claude_oauth

    if await claude_auth_status():
        try:
            await _mark_logged_in("claude_code")
            await _broadcast_catalogue_updated()
        except Exception as exc:
            logger.warning("[claude_code_login] mark/broadcast failed: %s", exc)
        return {
            "success": True,
            "already_logged_in": True,
            "message": "Already authenticated; refreshed status.",
        }

    result = await initiate_claude_oauth()
    if result.get("success"):
        asyncio.create_task(
            _finalize_claude_login(), name="claude_code_login_finalize",
        )
    return result


async def handle_claude_code_logout(
    data: Dict[str, Any],  # noqa: ARG001
    websocket: WebSocket,  # noqa: ARG001
) -> Dict[str, Any]:
    """Run ``claude auth logout``, drop the catalogue marker, broadcast."""
    from services.claude_oauth import claude_auth_logout

    try:
        await claude_auth_logout()
        await _mark_logged_out("claude_code")
        await _broadcast_catalogue_updated()
    except Exception as exc:
        logger.warning("[claude_code_logout] failed: %s", exc)
        return {"success": False, "error": str(exc)}
    return {"success": True}


# ---------------------------------------------------------------------------
# Codex — login flow not yet wired; logout works for marker cleanup
# ---------------------------------------------------------------------------

async def handle_codex_cli_login(
    data: Dict[str, Any],  # noqa: ARG001
    websocket: WebSocket,  # noqa: ARG001
) -> Dict[str, Any]:
    return {
        "success": False,
        "error": (
            "Codex login is not yet wired in MachinaOs. "
            "Install with `npm install -g @openai/codex` and run "
            "`codex login` in your terminal — then click Login again "
            "to mark connected."
        ),
    }


async def handle_codex_cli_logout(
    data: Dict[str, Any],  # noqa: ARG001
    websocket: WebSocket,  # noqa: ARG001
) -> Dict[str, Any]:
    try:
        await _mark_logged_out("codex_cli")
        await _broadcast_catalogue_updated()
    except Exception as exc:
        logger.warning("[codex_cli_logout] failed: %s", exc)
        return {"success": False, "error": str(exc)}
    return {"success": True}


# ---------------------------------------------------------------------------
# Registry payload — `services/cli_agent/__init__.py` registers these
# into `services.ws_handler_registry` on package import. Names match
# `credential_providers.json:ws.login/logout`.
# ---------------------------------------------------------------------------

WSHandler = Callable[[Dict[str, Any], WebSocket], Awaitable[Dict[str, Any]]]

WS_HANDLERS: Dict[str, WSHandler] = {
    "claude_code_login": handle_claude_code_login,
    "claude_code_logout": handle_claude_code_logout,
    "codex_cli_login": handle_codex_cli_login,
    "codex_cli_logout": handle_codex_cli_logout,
}
