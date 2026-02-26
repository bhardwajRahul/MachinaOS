"""
Twitter/X OAuth 2.0 with PKCE - Browser-based login flow for X API v2.

Based on official X API documentation:
- Authorization URL: https://x.com/i/oauth2/authorize
- Token URL: https://api.x.com/2/oauth2/token
- Docs: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code

Access tokens expire in 2 hours by default. Use offline.access scope for refresh tokens.
Authorization codes expire in 30 seconds.
"""

import base64
import hashlib
import secrets
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx

from core.logging import get_logger

logger = get_logger(__name__)

# X API OAuth 2.0 endpoints (updated URLs per latest docs)
AUTHORIZATION_URL = "https://x.com/i/oauth2/authorize"
TOKEN_URL = "https://api.x.com/2/oauth2/token"
REVOKE_URL = "https://api.x.com/2/oauth2/revoke"
USER_INFO_URL = "https://api.x.com/2/users/me"

# Required scopes for full Twitter integration
# See: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
DEFAULT_SCOPES = [
    "tweet.read",       # Read tweets
    "tweet.write",      # Post tweets
    "users.read",       # User lookup
    "follows.read",     # Read followers/following
    "like.read",        # Read likes
    "like.write",       # Like/unlike tweets
    "offline.access",   # Enable refresh tokens (access tokens expire in 2 hours)
]

# In-memory store for PKCE state (production should use Redis/database)
_oauth_states: Dict[str, Dict[str, Any]] = {}


def _generate_code_verifier() -> str:
    """
    Generate a cryptographically random code verifier (43-128 chars).
    Per RFC 7636, must be 43-128 characters from [A-Z, a-z, 0-9, -, ., _, ~].
    """
    # Generate 96 random bytes, encode to base64url (128 chars after stripping padding)
    random_bytes = secrets.token_bytes(96)
    verifier = base64.urlsafe_b64encode(random_bytes).rstrip(b"=").decode("ascii")
    return verifier[:128]


def _generate_code_challenge(code_verifier: str) -> str:
    """
    Generate S256 code challenge from verifier.
    challenge = BASE64URL(SHA256(code_verifier))
    """
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return challenge


def _generate_state() -> str:
    """Generate random state parameter for CSRF protection (up to 500 chars per X docs)."""
    return secrets.token_urlsafe(32)


class TwitterOAuth:
    """
    Twitter/X OAuth 2.0 with PKCE flow implementation.

    Usage:
        oauth = TwitterOAuth(client_id="...", redirect_uri="http://localhost:3010/api/twitter/callback")  # URI derived at runtime

        # Step 1: Generate authorization URL
        auth_data = oauth.generate_authorization_url()
        # Redirect user to auth_data["url"]

        # Step 2: Handle callback and exchange code
        tokens = await oauth.exchange_code(code="...", state="...")

        # Step 3: Use access_token for API calls
        user_info = await oauth.get_user_info(tokens["access_token"])
    """

    def __init__(
        self,
        client_id: str,
        redirect_uri: str,
        client_secret: Optional[str] = None,
        scopes: Optional[list] = None,
    ):
        """
        Initialize Twitter OAuth client.

        Args:
            client_id: Twitter OAuth 2.0 Client ID (from Developer Portal)
            client_secret: Client Secret (required for confidential clients, optional for public clients with PKCE)
            redirect_uri: OAuth callback URL (must match Developer Portal settings exactly)
            scopes: List of OAuth scopes (defaults to DEFAULT_SCOPES)
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes or DEFAULT_SCOPES

    def generate_authorization_url(self) -> Dict[str, str]:
        """
        Generate OAuth authorization URL with PKCE parameters.

        Returns:
            Dict with:
                - url: Authorization URL to redirect user to
                - state: State parameter (for verification in callback)
                - code_verifier: PKCE code verifier (save for token exchange)
        """
        state = _generate_state()
        code_verifier = _generate_code_verifier()
        code_challenge = _generate_code_challenge(code_verifier)

        # Store state for verification (with expiry tracking)
        _oauth_states[state] = {
            "code_verifier": code_verifier,
            "created_at": time.time(),
            "redirect_uri": self.redirect_uri,
        }

        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.scopes),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        authorization_url = f"{AUTHORIZATION_URL}?{urlencode(params)}"

        logger.info("Generated Twitter OAuth authorization URL", state=state[:8])

        return {
            "url": authorization_url,
            "state": state,
            "code_verifier": code_verifier,
        }

    async def exchange_code(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token.

        Note: Authorization codes expire in 30 seconds per X docs.

        Args:
            code: Authorization code from callback
            state: State parameter for verification

        Returns:
            Dict with:
                - success: True/False
                - access_token: Bearer token for API calls (expires in 2 hours)
                - refresh_token: Token for refreshing access (if offline.access scope)
                - expires_in: Token expiry in seconds
                - scope: Granted scopes
        """
        # Verify state and get code_verifier
        oauth_state = _oauth_states.pop(state, None)
        if not oauth_state:
            logger.error("Invalid or expired OAuth state", state=state[:8] if state else "None")
            return {"success": False, "error": "Invalid or expired state"}

        code_verifier = oauth_state["code_verifier"]

        # Prepare token request body
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "code_verifier": code_verifier,
        }

        # Authentication: Basic auth for confidential clients, client_id in body for public clients
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        if self.client_secret:
            # Confidential client: use Basic auth
            credentials = base64.b64encode(
                f"{self.client_id}:{self.client_secret}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {credentials}"
        else:
            # Public client: include client_id in body
            data["client_id"] = self.client_id

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    TOKEN_URL,
                    data=data,
                    headers=headers,
                )

                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    logger.error(
                        "Token exchange failed",
                        status=response.status_code,
                        error=error_data,
                    )
                    return {
                        "success": False,
                        "error": error_data.get("error_description", error_data.get("error", "Token exchange failed")),
                    }

                token_data = response.json()
                logger.info("Twitter OAuth token exchange successful")

                return {
                    "success": True,
                    "access_token": token_data.get("access_token"),
                    "refresh_token": token_data.get("refresh_token"),
                    "expires_in": token_data.get("expires_in"),
                    "scope": token_data.get("scope"),
                    "token_type": token_data.get("token_type", "Bearer"),
                }

        except httpx.HTTPError as e:
            logger.error("HTTP error during token exchange", error=str(e))
            return {"success": False, "error": str(e)}

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh an expired access token.

        Args:
            refresh_token: The refresh token from previous authorization

        Returns:
            Dict with new access_token, refresh_token, expires_in
        """
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }

        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        if self.client_secret:
            credentials = base64.b64encode(
                f"{self.client_id}:{self.client_secret}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {credentials}"
        else:
            data["client_id"] = self.client_id

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    TOKEN_URL,
                    data=data,
                    headers=headers,
                )

                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    logger.error(
                        "Token refresh failed",
                        status=response.status_code,
                        error=error_data,
                    )
                    return {
                        "success": False,
                        "error": error_data.get("error_description", "Token refresh failed"),
                    }

                token_data = response.json()
                logger.info("Twitter token refresh successful")

                return {
                    "success": True,
                    "access_token": token_data.get("access_token"),
                    "refresh_token": token_data.get("refresh_token"),
                    "expires_in": token_data.get("expires_in"),
                    "scope": token_data.get("scope"),
                }

        except httpx.HTTPError as e:
            logger.error("HTTP error during token refresh", error=str(e))
            return {"success": False, "error": str(e)}

    async def revoke_token(self, token: str, token_type: str = "access_token") -> Dict[str, Any]:
        """
        Revoke an access or refresh token.

        Args:
            token: The token to revoke
            token_type: 'access_token' or 'refresh_token'

        Returns:
            Dict with success status
        """
        data = {
            "token": token,
            "token_type_hint": token_type,
        }

        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        if self.client_secret:
            credentials = base64.b64encode(
                f"{self.client_id}:{self.client_secret}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {credentials}"
        else:
            data["client_id"] = self.client_id

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    REVOKE_URL,
                    data=data,
                    headers=headers,
                )

                # 200 = success, even if token was already revoked
                if response.status_code == 200:
                    logger.info("Twitter token revoked successfully")
                    return {"success": True}
                else:
                    error_data = response.json() if response.text else {}
                    return {
                        "success": False,
                        "error": error_data.get("error_description", "Revocation failed"),
                    }

        except httpx.HTTPError as e:
            logger.error("HTTP error during token revocation", error=str(e))
            return {"success": False, "error": str(e)}

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get authenticated user information.

        Args:
            access_token: Valid Twitter access token

        Returns:
            Dict with user id, username, name, profile_image_url, verified
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    USER_INFO_URL,
                    params={"user.fields": "id,name,username,profile_image_url,verified"},
                    headers={"Authorization": f"Bearer {access_token}"},
                )

                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    error_detail = error_data.get("detail") or error_data.get("title", "Failed to get user info")
                    return {
                        "success": False,
                        "error": error_detail,
                    }

                data = response.json()
                user = data.get("data", {})

                return {
                    "success": True,
                    "id": user.get("id"),
                    "username": user.get("username"),
                    "name": user.get("name"),
                    "profile_image_url": user.get("profile_image_url"),
                    "verified": user.get("verified", False),
                }

        except httpx.HTTPError as e:
            logger.error("HTTP error getting user info", error=str(e))
            return {"success": False, "error": str(e)}


def cleanup_expired_states(max_age_seconds: int = 600):
    """
    Remove OAuth states older than max_age_seconds (default 10 minutes).

    Authorization codes expire in 30 seconds, so states older than a few
    minutes are definitely stale.
    """
    current_time = time.time()
    expired = [
        state
        for state, data in _oauth_states.items()
        if current_time - data["created_at"] > max_age_seconds
    ]
    for state in expired:
        _oauth_states.pop(state, None)

    if expired:
        logger.debug(f"Cleaned up {len(expired)} expired OAuth states")


def get_pending_state(state: str) -> Optional[Dict[str, Any]]:
    """Get pending OAuth state without removing it (for verification)."""
    return _oauth_states.get(state)
