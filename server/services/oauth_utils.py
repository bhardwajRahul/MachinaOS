"""Derive OAuth redirect URIs from request context -- no hardcoded ports.

WebSocket handlers call get_redirect_uri(websocket, "google") to build the full
callback URL at runtime.  The callback *path* comes from google_apis.json; the
base URL (scheme + host + port) comes from the connection itself.

    ws://localhost:3010/ws/status    -> http://localhost:3010/api/google/callback
    wss://flow.zeenie.xyz/ws/status  -> https://flow.zeenie.xyz/api/google/callback
    http://localhost:3010/api/google -> http://localhost:3010/api/google/callback
"""

from urllib.parse import urlparse

from services.google_oauth import get_callback_paths


def get_base_url(connection) -> str:
    """Derive HTTP base URL from a Starlette WebSocket or Request.

    Works with both ``WebSocket.base_url`` and ``Request.base_url``.
    Strips the path and converts ws(s) to http(s).
    """
    raw = str(connection.base_url).rstrip("/")
    parsed = urlparse(raw)

    # Convert ws(s) scheme to http(s)
    scheme = parsed.scheme.replace("ws", "http") if "ws" in parsed.scheme else parsed.scheme

    # netloc includes host:port
    return f"{scheme}://{parsed.netloc}"


def get_redirect_uri(connection, provider: str) -> str:
    """Build full OAuth redirect URI from request context + JSON config path.

    Args:
        connection: Starlette ``WebSocket`` or ``Request`` (anything with ``base_url``).
        provider: ``"google"`` or ``"twitter"``.

    Returns:
        Full redirect URI, e.g. ``http://localhost:3010/api/google/callback``.
    """
    paths = get_callback_paths()
    path = paths.get(provider, f"/api/{provider}/callback")
    return get_base_url(connection) + path
