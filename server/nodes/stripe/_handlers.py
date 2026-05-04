"""Stripe WebSocket handlers.

Login is a thin wrap around the Stripe CLI's two machine-friendly
flags:

* ``stripe login --non-interactive`` prints
  ``{browser_url, verification_code, next_step}`` JSON and exits.
* ``stripe login --complete <next_step>`` polls Stripe until the
  user authorises in the browser, then writes credentials to
  ``~/.config/stripe/config.toml`` and exits 0.

The ``stripe_login`` handler runs step 1 synchronously, returns the
URL and verification code to the frontend (same shape as Twitter /
Google ``oauth_login`` handlers), then fires step 2 as a background
task. When step 2 finishes, we kick the broadcaster's stripe-status
refresh callback so the modal updates reactively.

Every other lifecycle command (connect/disconnect/reconnect/status)
comes from :func:`services.events.make_lifecycle_handlers`.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict

from fastapi import WebSocket

from core.logging import get_logger
from services.events import make_lifecycle_handlers, run_cli_command

from ._install import ensure_stripe_cli, stripe_cli_path
from ._source import (
    get_listen_source,
    is_logged_in,
    stripe_config_path,
)

logger = get_logger(__name__)


_LOGIN_TIMEOUT_SECONDS = 600


async def _resolved_binary() -> str | None:
    """Resolve the stripe binary path, downloading on first use.
    Returns None on install failure (caller should surface error)."""
    try:
        return str(await ensure_stripe_cli())
    except Exception as e:
        logger.warning("[Stripe] CLI install failed: %s", e)
        return None


async def _status_snapshot() -> Dict[str, Any]:
    """Compose the daemon-status + login-state dict the modal renders."""
    src = get_listen_source()
    status = await src.status()
    status["logged_in"] = is_logged_in()
    status["connected"] = bool(status.get("running")) and status["logged_in"]
    return status


# --- Catalogue-stored marker -------------------------------------------------
#
# The catalogue handler in routers/websocket.py keys its "stored" check off
# `auth_service.get_oauth_tokens(status_hook)` for any provider with
# `status_hook` set (the Google / Twitter pattern). The Stripe CLI manages
# its own auth at ~/.config/stripe/config.toml — there are no real OAuth
# tokens for us to store. We persist a synthetic marker via the same API
# Google/Twitter use, so the catalogue's existing logic flips
# `stored: true` after login without any node-specific code in the
# catalogue handler.

_MARKER_TOKEN = "cli-managed"


async def _mark_logged_in() -> None:
    from core.container import container
    await container.auth_service().store_oauth_tokens(
        provider="stripe",
        access_token=_MARKER_TOKEN,
        refresh_token=_MARKER_TOKEN,
    )


async def _mark_logged_out() -> None:
    from core.container import container
    await container.auth_service().remove_oauth_tokens("stripe")


async def _broadcast_catalogue_updated() -> None:
    """Trigger the generic catalogue invalidation listener already wired
    in WebSocketContext (`case 'credential_catalogue_updated'`). The
    frontend refetches the catalogue and sees the new stored state."""
    from services.status_broadcaster import get_status_broadcaster
    await get_status_broadcaster().broadcast({"type": "credential_catalogue_updated"})


async def handle_stripe_trigger(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Run ``stripe trigger <event>`` for synthetic test events."""
    event = data.get("event")
    if not event:
        return {"success": False, "error": "event required (e.g. 'charge.succeeded')"}
    binary = await _resolved_binary()
    if not binary:
        return {"success": False, "error": "Stripe CLI install failed"}
    return await run_cli_command(binary=binary, argv=["trigger", event])


async def handle_stripe_login(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Step 1 of CLI OAuth: get the browser URL + verification code."""
    binary = await _resolved_binary()
    if not binary:
        return {
            "success": False,
            "error": "Stripe CLI install failed. Manual install: https://stripe.com/docs/stripe-cli#install",
        }
    result = await run_cli_command(
        binary=binary, argv=["login", "--non-interactive"], timeout=10.0,
    )
    if not result["success"]:
        return result
    try:
        info = json.loads(result["stdout"])
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"unparseable stripe login response: {e}"}

    next_step = info.get("next_step")
    url = info.get("browser_url") or info.get("url")
    if not (url and next_step):
        return {"success": False, "error": "stripe login response missing browser_url / next_step"}

    asyncio.create_task(_complete_login(binary, next_step))
    return {
        "success": True,
        "url": url,
        "verification_code": info.get("verification_code"),
    }


async def _complete_login(binary: str, next_step: str) -> None:
    """Step 2: block on ``stripe login --complete`` until the user
    authorises (or the 10-min timeout fires). On success, write the
    same kind of marker the Google / Twitter callbacks write so the
    catalogue's stored-check flips, then auto-start the listen
    daemon and trigger the generic catalogue refresh on the frontend."""
    await run_cli_command(
        binary=binary, argv=["login", "--complete", next_step],
        timeout=_LOGIN_TIMEOUT_SECONDS,
    )
    if is_logged_in():
        logger.info("[Stripe] login completed; auto-starting listen daemon")
        await _mark_logged_in()
        await get_listen_source().start()
    await _broadcast_catalogue_updated()


async def handle_stripe_logout(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Stop the daemon (if running) and run ``stripe logout --all`` to
    clear ``~/.config/stripe/config.toml``. Mirror the Google/Twitter
    logout shape: drop the catalogue marker token + broadcast the
    generic catalogue invalidation so the modal flips immediately."""
    await get_listen_source().stop()
    cached = stripe_cli_path()
    if cached is None:
        cfg = stripe_config_path()
        if cfg.exists():
            cfg.unlink(missing_ok=True)
        result: Dict[str, Any] = {"success": True, "message": "Logged out (CLI not yet installed; cleared config file)"}
    else:
        result = await run_cli_command(binary=str(cached), argv=["logout", "--all"], timeout=10.0)
    await _mark_logged_out()
    await _broadcast_catalogue_updated()
    return result


async def handle_stripe_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Augments the stock daemon-status with login-state."""
    return {"success": True, "status": await _status_snapshot()}


WS_HANDLERS = make_lifecycle_handlers(
    prefix="stripe",
    source=get_listen_source(),
    extra={
        "stripe_login": handle_stripe_login,
        "stripe_logout": handle_stripe_logout,
        "stripe_trigger": handle_stripe_trigger,
    },
)
WS_HANDLERS["stripe_status"] = handle_stripe_status
