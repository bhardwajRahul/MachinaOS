"""
Gmail OAuth 2.0 using google-auth-oauthlib library.

Two access modes:
1. Owner Mode - Your own Gmail (Credentials Modal)
2. Customer Mode - Customer's Gmail (database storage)

Docs: https://googleapis.dev/python/google-auth-oauthlib/latest/reference/google_auth_oauthlib.flow.html
"""

import json
import secrets
import time
from typing import Any, Dict, List, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from core.logging import get_logger

logger = get_logger(__name__)

# Gmail API scopes
DEFAULT_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
]

# In-memory state store (use Redis in production)
_oauth_states: Dict[str, Dict[str, Any]] = {}


class GmailOAuth:
    """Gmail OAuth 2.0 using google-auth-oauthlib Flow."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str = "http://localhost:3010/api/gmail/callback",
        scopes: Optional[List[str]] = None,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes or DEFAULT_SCOPES

        # Build client config in Google's format
        self.client_config = {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        }

    def generate_authorization_url(
        self,
        state_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, str]:
        """
        Generate OAuth authorization URL.

        Args:
            state_data: Optional data (customer_id, mode, redirect_after)

        Returns:
            Dict with url and state
        """
        # Create Flow from client config
        flow = Flow.from_client_config(
            self.client_config,
            scopes=self.scopes,
            redirect_uri=self.redirect_uri,
        )

        # Generate authorization URL with offline access for refresh tokens
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",  # Force consent to get refresh token
        )

        # Store state data for callback verification
        _oauth_states[state] = {
            "created_at": time.time(),
            "data": state_data or {"mode": "owner"},
        }

        logger.info("Generated Gmail OAuth URL", state=state[:8])

        return {
            "url": authorization_url,
            "state": state,
        }

    def exchange_code(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for credentials.

        Args:
            code: Authorization code from callback
            state: State for verification

        Returns:
            Dict with tokens and user info
        """
        # Verify state
        oauth_state = _oauth_states.pop(state, None)
        if not oauth_state:
            return {"success": False, "error": "Invalid or expired state"}

        state_data = oauth_state.get("data", {})

        try:
            # Create Flow and fetch token
            flow = Flow.from_client_config(
                self.client_config,
                scopes=self.scopes,
                redirect_uri=self.redirect_uri,
                state=state,
            )
            flow.fetch_token(code=code)

            # Get credentials from flow
            creds = flow.credentials

            # Get user info
            user_info = self._get_user_info(creds)

            logger.info("Gmail OAuth successful", email=user_info.get("email", "")[:20])

            return {
                "success": True,
                "access_token": creds.token,
                "refresh_token": creds.refresh_token,
                "expires_in": 3600,
                "token_uri": creds.token_uri,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "scopes": list(creds.scopes) if creds.scopes else self.scopes,
                "state_data": state_data,
                "email": user_info.get("email"),
                "name": user_info.get("name"),
            }

        except Exception as e:
            logger.error("Token exchange failed", error=str(e))
            return {"success": False, "error": str(e)}

    def _get_user_info(self, creds: Credentials) -> Dict[str, Any]:
        """Get user info using credentials."""
        try:
            service = build("oauth2", "v2", credentials=creds)
            user_info = service.userinfo().get().execute()
            return {
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
            }
        except Exception as e:
            logger.error("Failed to get user info", error=str(e))
            return {}

    @staticmethod
    def refresh_credentials(
        refresh_token: str,
        client_id: str,
        client_secret: str,
        token_uri: str = "https://oauth2.googleapis.com/token",
    ) -> Dict[str, Any]:
        """
        Refresh expired credentials.

        Args:
            refresh_token: The refresh token
            client_id: OAuth client ID
            client_secret: OAuth client secret
            token_uri: Token endpoint

        Returns:
            Dict with new access_token
        """
        try:
            creds = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri=token_uri,
                client_id=client_id,
                client_secret=client_secret,
            )
            creds.refresh(Request())

            return {
                "success": True,
                "access_token": creds.token,
                "expires_in": 3600,
            }
        except Exception as e:
            logger.error("Token refresh failed", error=str(e))
            return {"success": False, "error": str(e), "needs_reauth": True}

    @staticmethod
    def build_credentials(
        access_token: str,
        refresh_token: str,
        client_id: str,
        client_secret: str,
        token_uri: str = "https://oauth2.googleapis.com/token",
        scopes: Optional[List[str]] = None,
    ) -> Credentials:
        """
        Build Credentials object from stored tokens.

        Use this to create credentials for Gmail API calls.
        """
        return Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri=token_uri,
            client_id=client_id,
            client_secret=client_secret,
            scopes=scopes or DEFAULT_SCOPES,
        )

    @staticmethod
    def build_gmail_service(creds: Credentials):
        """Build Gmail API service from credentials."""
        return build("gmail", "v1", credentials=creds)


def cleanup_expired_states(max_age_seconds: int = 600):
    """Remove expired OAuth states."""
    current_time = time.time()
    expired = [
        state for state, data in _oauth_states.items()
        if current_time - data["created_at"] > max_age_seconds
    ]
    for state in expired:
        _oauth_states.pop(state, None)


def get_pending_state(state: str) -> Optional[Dict[str, Any]]:
    """Get pending state without removing it."""
    return _oauth_states.get(state)
