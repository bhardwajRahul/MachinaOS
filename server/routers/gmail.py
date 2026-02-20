"""
Gmail OAuth 2.0 callback and API routes.

OAuth flow:
1. Frontend calls WebSocket 'gmail_oauth_login' handler
2. Backend generates authorization URL, opens browser
3. User authorizes on Google
4. Google redirects to /api/gmail/callback with code
5. Backend exchanges code for tokens, stores them via auth_service
6. Frontend polls WebSocket 'gmail_oauth_status' for completion

Two access modes:
- Owner Mode: Tokens stored via auth_service (single account)
- Customer Mode: Tokens stored in gmail_connections table (multi-account)
"""

from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, RedirectResponse

from core.container import container
from core.logging import get_logger
from services.gmail_oauth import GmailOAuth, get_pending_state

logger = get_logger(__name__)
router = APIRouter(prefix="/api/gmail", tags=["gmail"])


def get_settings():
    """Get application settings."""
    return container.settings()


def get_auth_service():
    """Get auth service for API key storage."""
    return container.auth_service()


def get_database():
    """Get database for customer connections."""
    return container.database()


@router.get("/callback")
async def gmail_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
):
    """
    Handle Gmail OAuth callback.

    Google redirects here after user authorizes (or denies) the app.
    """
    # Handle authorization denied
    if error:
        logger.warning(f"Gmail OAuth denied: {error} - {error_description}")
        return HTMLResponse(
            content=_callback_html(success=False, error=error_description or error),
            status_code=200,
        )

    # Validate required parameters
    if not code or not state:
        logger.error("Gmail OAuth callback missing code or state")
        return HTMLResponse(
            content=_callback_html(success=False, error="Missing authorization code or state"),
            status_code=400,
        )

    # Verify state exists (CSRF protection)
    pending_state = get_pending_state(state)
    if not pending_state:
        logger.error("Gmail OAuth callback with invalid/expired state")
        return HTMLResponse(
            content=_callback_html(success=False, error="Invalid or expired state. Please try again."),
            status_code=400,
        )

    # Get state data
    state_data = pending_state.get("data", {})
    mode = state_data.get("mode", "owner")
    customer_id = state_data.get("customer_id")
    redirect_after = state_data.get("redirect_after")

    # Get settings and credentials
    settings = get_settings()
    auth_service = get_auth_service()
    client_id = await auth_service.get_api_key("gmail_client_id") or ""
    client_secret = await auth_service.get_api_key("gmail_client_secret") or ""

    if not client_id or not client_secret:
        return HTMLResponse(
            content=_callback_html(success=False, error="Gmail not configured. Add Client ID and Secret in Credentials."),
            status_code=400,
        )

    oauth = GmailOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=settings.gmail_redirect_uri,
    )

    # Exchange code for tokens
    result = oauth.exchange_code(code=code, state=state)

    if not result.get("success"):
        logger.error(f"Gmail token exchange failed: {result.get('error')}")
        return HTMLResponse(
            content=_callback_html(success=False, error=result.get("error", "Token exchange failed")),
            status_code=400,
        )

    email = result.get("email", "Unknown")
    name = result.get("name", "")
    access_token = result.get("access_token")
    refresh_token = result.get("refresh_token")

    if mode == "customer" and customer_id:
        # Customer mode: store in gmail_connections table
        database = get_database()
        await database.save_gmail_connection(
            customer_id=customer_id,
            email=email,
            name=name,
            access_token=access_token,
            refresh_token=refresh_token,
            scopes=",".join(result.get("scopes", [])),
        )
        logger.info(f"Gmail OAuth successful for customer {customer_id}: {email}")

        if redirect_after:
            return RedirectResponse(url=f"{redirect_after}?gmail_connected=true&customer={customer_id}&email={email}")
    else:
        # Owner mode: store via auth_service
        await auth_service.store_api_key(provider="gmail_access_token", api_key=access_token, models=[], session_id="default")
        if refresh_token:
            await auth_service.store_api_key(provider="gmail_refresh_token", api_key=refresh_token, models=[], session_id="default")
        await auth_service.store_api_key(provider="gmail_user_info", api_key=f"{email}:{name}", models=[], session_id="default")
        logger.info(f"Gmail OAuth successful for {email}")

    # Broadcast completion event
    from services.status_broadcaster import get_status_broadcaster
    broadcaster = get_status_broadcaster()
    await broadcaster.broadcast({
        "type": "gmail_oauth_complete",
        "data": {"success": True, "email": email, "name": name, "mode": mode, "customer_id": customer_id},
    })

    return HTMLResponse(content=_callback_html(success=True, email=email), status_code=200)


@router.get("/status")
async def get_gmail_status():
    """Get Gmail connection status for owner mode."""
    auth_service = get_auth_service()
    access_token = await auth_service.get_api_key("gmail_access_token")

    if not access_token:
        return {"connected": False, "email": None}

    user_info_str = await auth_service.get_api_key("gmail_user_info")
    email, name = None, None
    if user_info_str:
        parts = user_info_str.split(":", 1)
        email = parts[0] if parts else None
        name = parts[1] if len(parts) > 1 else None

    return {"connected": True, "email": email, "name": name}


@router.post("/logout")
async def gmail_logout():
    """Disconnect Gmail (owner mode)."""
    auth_service = get_auth_service()
    await auth_service.remove_api_key("gmail_access_token")
    await auth_service.remove_api_key("gmail_refresh_token")
    await auth_service.remove_api_key("gmail_user_info")
    logger.info("Gmail disconnected")
    return {"success": True, "message": "Gmail disconnected"}


@router.post("/customer-auth-url")
async def generate_customer_auth_url(customer_id: str, redirect_after: Optional[str] = None):
    """Generate OAuth URL for a customer to connect their Gmail."""
    settings = get_settings()
    auth_service = get_auth_service()
    client_id = await auth_service.get_api_key("gmail_client_id") or ""
    client_secret = await auth_service.get_api_key("gmail_client_secret") or ""

    if not client_id or not client_secret:
        return {"success": False, "error": "Gmail not configured. Add Client ID and Secret."}

    oauth = GmailOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=settings.gmail_redirect_uri,
    )
    result = oauth.generate_authorization_url(state_data={"customer_id": customer_id, "redirect_after": redirect_after, "mode": "customer"})
    return {"success": True, "url": result["url"], "state": result["state"]}


@router.get("/customer/{customer_id}/status")
async def get_customer_gmail_status(customer_id: str):
    """Get Gmail connection status for a customer."""
    database = get_database()
    connection = await database.get_gmail_connection(customer_id)
    if not connection:
        return {"connected": False, "customer_id": customer_id}
    return {
        "connected": connection.is_active,
        "customer_id": customer_id,
        "email": connection.email,
        "name": connection.name,
        "connected_at": connection.connected_at.isoformat() if connection.connected_at else None,
    }


@router.post("/customer/{customer_id}/disconnect")
async def disconnect_customer_gmail(customer_id: str):
    """Disconnect a customer's Gmail."""
    database = get_database()
    await database.delete_gmail_connection(customer_id)
    logger.info(f"Gmail disconnected for customer {customer_id}")
    return {"success": True, "customer_id": customer_id}


def _callback_html(success: bool, email: str = None, error: str = None) -> str:
    """Generate callback HTML page."""
    if success:
        title, message, color = "Gmail Connected", f"Successfully connected as {email}!", "#34a853"
    else:
        title, message, color = "Connection Failed", error or "Failed to connect", "#ea4335"

    return f"""<!DOCTYPE html>
<html>
<head><title>{title}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#15202b,#1a1a2e);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}}
.container{{text-align:center;padding:40px;background:rgba(255,255,255,0.05);border-radius:16px;border:1px solid rgba(255,255,255,0.1);max-width:400px}}
.icon{{width:64px;height:64px;margin-bottom:20px;color:{color}}}
h1{{font-size:24px;margin-bottom:12px;color:{color}}}
p{{font-size:16px;color:rgba(255,255,255,0.8);margin-bottom:20px}}
.close-text{{font-size:14px;color:rgba(255,255,255,0.5)}}
</style></head>
<body><div class="container">
<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
{"<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'/>" if success else "<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'/>"}
</svg>
<h1>{title}</h1><p>{message}</p><p class="close-text">This window will close automatically...</p>
</div>
<script>
if(window.opener){{window.opener.postMessage({{type:'gmail_oauth_callback',success:{str(success).lower()},{"email:'"+email+"'," if email else ""}{"error:'"+error.replace("'","\\'")+"'," if error else ""}}},'*')}}
setTimeout(function(){{window.close()}},2000);
</script></body></html>"""
