"""Twitter / X WebSocket handlers — plugin-owned dispatch table.

OAuth 2.0 PKCE login + status + logout flows. Self-registered into
the central WS dispatcher via ``register_ws_handlers(WS_HANDLERS)``
from this package's ``__init__.py``. ``routers/websocket.py`` knows
nothing about Twitter; the message-type strings are wired here so
renames / additions stay local to the plugin.

Companion: ``_router.py`` owns the OAuth callback endpoint
(``/api/twitter/callback``) — same redirect URI the WS login flow
asks the user to visit. Both share the same ``TwitterOAuth`` client
in ``_oauth.py``.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import WebSocket

from core.logging import get_logger
from services.oauth_utils import get_redirect_uri
from services.status_broadcaster import get_status_broadcaster

from ._oauth import TwitterOAuth

logger = get_logger(__name__)


async def handle_twitter_oauth_login(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Initiate Twitter OAuth 2.0 with PKCE flow.

    Opens the browser to Twitter's authorization page. After the user
    authorises, Twitter redirects to ``/api/twitter/callback`` (owned
    by ``_router.py``) which stores tokens via ``auth_service``.
    """
    # Lazy ``container`` import — same idiom the original handler used
    # in ``routers/websocket.py``. Keeps test monkeypatching simple
    # (the singleton lookup happens at call time, post-patch).
    from core.container import container

    auth_service = container.auth_service()

    # Stored client credentials (configured via Credentials Modal).
    client_id = await auth_service.get_api_key("twitter_client_id")
    client_secret = await auth_service.get_api_key("twitter_client_secret")

    if not client_id:
        return {
            "success": False,
            "error": "Twitter Client ID not configured. Add your Twitter API credentials first.",
        }

    redirect_uri = get_redirect_uri(websocket, "twitter")
    oauth = TwitterOAuth(client_id=client_id, client_secret=client_secret, redirect_uri=redirect_uri)
    auth_data = oauth.generate_authorization_url()

    return {
        "success": True,
        "message": "Opening Twitter authorization in browser...",
        "url": auth_data["url"],
        "state": auth_data["state"],
    }


async def handle_twitter_oauth_status(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Check Twitter OAuth connection status.

    Returns connection status + user info if connected. Tokens live in
    the OAuth system (``EncryptedOAuthToken`` table); never read via
    ``get_api_key("twitter_access_token")`` — that's the wrong table.
    Refreshes silently if the access token is rejected and a refresh
    token exists.
    """
    from core.container import container

    auth_service = container.auth_service()

    tokens = await auth_service.get_oauth_tokens("twitter", customer_id="owner")
    if not tokens or not tokens.get("access_token"):
        return {"connected": False, "username": None, "user_id": None}

    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    client_id = await auth_service.get_api_key("twitter_client_id") or ""
    client_secret = await auth_service.get_api_key("twitter_client_secret")
    redirect_uri = get_redirect_uri(websocket, "twitter")

    oauth = TwitterOAuth(client_id=client_id, client_secret=client_secret, redirect_uri=redirect_uri)
    user_info = await oauth.get_user_info(access_token)

    if not user_info.get("success") and refresh_token:
        refresh_result = await oauth.refresh_access_token(refresh_token)
        if refresh_result.get("success"):
            await auth_service.store_oauth_tokens(
                provider="twitter",
                access_token=refresh_result["access_token"],
                refresh_token=refresh_result.get("refresh_token") or refresh_token,
                email=tokens.get("email", ""),
                name=tokens.get("name", ""),
                scopes=tokens.get("scopes", ""),
                customer_id="owner",
            )
            user_info = await oauth.get_user_info(refresh_result["access_token"])

    if not user_info.get("success"):
        return {
            "connected": False,
            "username": None,
            "user_id": None,
            "error": user_info.get("error"),
        }

    return {
        "connected": True,
        "username": user_info.get("username"),
        "user_id": user_info.get("id"),
        "name": user_info.get("name"),
        "profile_image_url": user_info.get("profile_image_url"),
        "verified": user_info.get("verified"),
    }


async def handle_twitter_logout(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Disconnect Twitter: revoke tokens + clear stored credentials.

    Per RFC 9700 the refresh-token is read directly from the DB
    (``get_oauth_refresh_token``) instead of from the in-memory cache.
    Symmetric ``credential.oauth.disconnected`` broadcast fires the
    catalogue refetch on every connected client.
    """
    from core.container import container

    auth_service = container.auth_service()

    tokens = await auth_service.get_oauth_tokens("twitter", customer_id="owner")
    access_token = tokens.get("access_token") if tokens else None
    refresh_token = (
        await auth_service.get_oauth_refresh_token("twitter", customer_id="owner")
        if tokens
        else None
    )

    client_id = await auth_service.get_api_key("twitter_client_id") or ""
    client_secret = await auth_service.get_api_key("twitter_client_secret")

    if access_token or refresh_token:
        redirect_uri = get_redirect_uri(websocket, "twitter")
        oauth = TwitterOAuth(client_id=client_id, client_secret=client_secret, redirect_uri=redirect_uri)
        if access_token:
            await oauth.revoke_token(access_token, "access_token")
        if refresh_token:
            await oauth.revoke_token(refresh_token, "refresh_token")

    await auth_service.remove_oauth_tokens("twitter", customer_id="owner")

    # Clean up any stale API-key entries from the old (broken) layout
    # where access tokens were mistakenly stored as API keys.
    for key in ("twitter_access_token", "twitter_refresh_token", "twitter_user_info"):
        try:
            await auth_service.remove_api_key(key)
        except Exception:
            pass

    broadcaster = get_status_broadcaster()
    await broadcaster.broadcast_credential_event(
        "credential.oauth.disconnected",
        provider="twitter",
        customer_id="owner",
    )

    return {"success": True, "message": "Twitter disconnected"}


WS_HANDLERS = {
    "twitter_oauth_login": handle_twitter_oauth_login,
    "twitter_oauth_status": handle_twitter_oauth_status,
    "twitter_logout": handle_twitter_logout,
}
