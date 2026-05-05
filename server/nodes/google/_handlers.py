"""Google Workspace WebSocket handlers — plugin-owned dispatch table.

OAuth 2.0 flow for the 6 Google Workspace plugins (Gmail, Calendar,
Drive, Sheets, Tasks, Contacts) — they share a single OAuth grant and
a single ``GoogleCredential`` class. The HTTP callback that completes
the flow lives in :mod:`._router` (mounted via ``register_router``);
the live-state probe + logout flows are WebSocket handlers
self-registered into the central WS dispatcher via
:func:`register_ws_handlers` from this package's ``__init__.py``.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import WebSocket

from core.logging import get_logger
from services.oauth_utils import get_redirect_uri
from services.status_broadcaster import get_status_broadcaster

from ._oauth import GoogleOAuth

logger = get_logger(__name__)


async def handle_google_oauth_login(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Initiate the Google Workspace OAuth 2.0 flow.

    Opens the browser to the Google authorisation page; after consent
    Google redirects to ``/api/google/callback`` (owned by
    :mod:`._router`) which stores tokens via ``auth_service``. One
    grant covers all 6 Workspace services.
    """
    from core.container import container

    auth_service = container.auth_service()
    client_id = await auth_service.get_api_key("google_client_id")
    client_secret = await auth_service.get_api_key("google_client_secret")

    if not client_id or not client_secret:
        return {
            "success": False,
            "error": (
                "Google Workspace Client ID and Secret not configured. "
                "Add your Google API credentials first."
            ),
        }

    redirect_uri = get_redirect_uri(websocket, "google")
    oauth = GoogleOAuth(client_id=client_id, client_secret=client_secret, redirect_uri=redirect_uri)
    auth_data = oauth.generate_authorization_url()

    return {
        "success": True,
        "message": "Opening Google authorization in browser...",
        "url": auth_data["url"],
        "state": auth_data["state"],
    }


async def handle_google_oauth_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Check Google Workspace OAuth connection status.

    Returns connection state + user info; proactively refreshes the
    access token if a refresh token is on file (RFC 9700 — refresh
    tokens are read directly from the DB, not the in-memory cache).
    Mirrors the result into the broadcaster's status snapshot so
    reconnecting clients pick up the current state.
    """
    from core.container import container

    auth_service = container.auth_service()
    broadcaster = get_status_broadcaster()

    tokens = await auth_service.get_oauth_tokens("google", customer_id="owner")
    if not tokens or not tokens.get("access_token"):
        status = {"connected": False, "email": None, "name": None}
        broadcaster._status["google"] = status
        return status

    email = tokens.get("email")
    name = tokens.get("name")
    refresh_token = await auth_service.get_oauth_refresh_token("google", customer_id="owner")

    try:
        client_id = await auth_service.get_api_key("google_client_id") or ""
        client_secret = await auth_service.get_api_key("google_client_secret") or ""

        if refresh_token and client_id and client_secret:
            refreshed = GoogleOAuth.refresh_credentials(
                refresh_token=refresh_token,
                client_id=client_id,
                client_secret=client_secret,
            )
            if refreshed.get("success") and refreshed.get("access_token"):
                await auth_service.store_oauth_tokens(
                    provider="google",
                    access_token=refreshed["access_token"],
                    refresh_token=refresh_token,
                    email=email,
                    name=name,
                    customer_id="owner",
                )

        status = {"connected": True, "email": email, "name": name}
        broadcaster._status["google"] = status
        await broadcaster.broadcast({"type": "google_status", "data": status})
        return status
    except Exception as e:  # noqa: BLE001 — log and return failure envelope
        logger.warning(f"Google token validation failed: {e}")
        status = {"connected": False, "email": None, "name": None, "error": str(e)}
        broadcaster._status["google"] = {"connected": False, "email": None, "name": None}
        return status


async def handle_google_logout(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Disconnect Google Workspace and clear stored credentials.

    Symmetric ``credential.oauth.disconnected`` broadcast fires the
    catalogue refetch on every connected client (uniform contract with
    twitter / telegram disconnect paths). The legacy
    ``google_status`` broadcast is kept too so existing FE listeners
    continue to update.
    """
    from core.container import container

    auth_service = container.auth_service()
    broadcaster = get_status_broadcaster()

    await auth_service.remove_oauth_tokens("google", customer_id="owner")

    cleared = {"connected": False, "email": None, "name": None}
    broadcaster._status["google"] = cleared
    await broadcaster.broadcast({"type": "google_status", "data": cleared})

    await broadcaster.broadcast_credential_event(
        "credential.oauth.disconnected",
        provider="google",
        customer_id="owner",
    )
    return {"success": True, "message": "Google Workspace disconnected"}


WS_HANDLERS = {
    "google_oauth_login": handle_google_oauth_login,
    "google_oauth_status": handle_google_oauth_status,
    "google_logout": handle_google_logout,
}
