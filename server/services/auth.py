"""API key management service with encrypted credentials database."""

import hashlib
from typing import Dict, Any, Optional, List

from core.config import Settings
from core.database import Database
from core.cache import CacheService
from core.credentials_database import CredentialsDatabase
from core.logging import get_logger

logger = get_logger(__name__)


class AuthService:
    """API key management service using encrypted credentials database.

    Uses CredentialsDatabase for secure storage with Fernet encryption.
    Decrypted keys are cached in memory only (not Redis) for security.
    """

    def __init__(
        self,
        credentials_db: CredentialsDatabase,
        cache: CacheService,
        database: Database,
        settings: Settings
    ):
        self.credentials_db = credentials_db
        self.cache = cache  # Kept for backward compatibility, not used for API keys
        self.database = database  # Kept for backward compatibility
        self.settings = settings
        # Memory-only cache for decrypted API keys (never persisted to Redis/disk)
        self._memory_cache: Dict[str, str] = {}
        # Memory-only cache for models list
        self._models_cache: Dict[str, List[str]] = {}
        # Memory-only cache for OAuth tokens
        self._oauth_cache: Dict[str, Dict[str, Any]] = {}

    def hash_api_key(self, api_key: str) -> str:
        """Create hash for API key identification."""
        return hashlib.sha256(api_key.encode()).hexdigest()[:16]

    async def store_api_key(
        self,
        provider: str,
        api_key: str,
        models: List[str],
        session_id: str = "default"
    ) -> bool:
        """Store API key with models in encrypted credentials database.

        Args:
            provider: API provider name (e.g., 'openai', 'anthropic')
            api_key: The API key to store (will be encrypted)
            models: List of available models for this key
            session_id: Session identifier for multi-user support

        Returns:
            True if stored successfully, False otherwise
        """
        try:
            cache_key = f"{session_id}_{provider}"

            logger.info(f"Storing API key for provider: {provider}, session: {session_id}")

            # Store in encrypted credentials database
            await self.credentials_db.save_api_key(
                provider=provider,
                api_key=api_key,
                models=models,
                session_id=session_id
            )

            # Cache decrypted key in memory only (for quick access)
            self._memory_cache[cache_key] = api_key
            self._models_cache[cache_key] = models

            logger.info(f"Stored and cached API key for {provider}")
            return True

        except Exception as e:
            logger.error("Failed to store API key", provider=provider, error=str(e))
            return False

    async def get_api_key(self, provider: str, session_id: str = "default") -> Optional[str]:
        """Get decrypted API key.

        Checks memory cache first, then falls back to encrypted database.

        Args:
            provider: API provider name
            session_id: Session identifier

        Returns:
            Decrypted API key or None if not found/expired
        """
        try:
            cache_key = f"{session_id}_{provider}"

            # Check memory cache first (fastest, most secure)
            if cache_key in self._memory_cache:
                return self._memory_cache[cache_key]

            # Fallback to encrypted database
            api_key = await self.credentials_db.get_api_key(provider, session_id)
            if api_key:
                # Cache in memory for quick subsequent access
                self._memory_cache[cache_key] = api_key
                return api_key

            return None

        except Exception as e:
            logger.error("Failed to get API key", provider=provider, error=str(e))
            return None

    async def get_stored_models(self, provider: str, session_id: str = "default") -> List[str]:
        """Get stored models for provider.

        Args:
            provider: API provider name
            session_id: Session identifier

        Returns:
            List of model names or empty list
        """
        try:
            cache_key = f"{session_id}_{provider}"

            # Check memory cache first
            if cache_key in self._models_cache:
                return self._models_cache[cache_key]

            # Fallback to encrypted database
            models = await self.credentials_db.get_api_key_models(provider, session_id)
            if models:
                self._models_cache[cache_key] = models
                return models

            return []

        except Exception as e:
            logger.error("Failed to get stored models", provider=provider, error=str(e))
            return []

    async def remove_api_key(self, provider: str, session_id: str = "default") -> bool:
        """Remove API key from storage and cache.

        Args:
            provider: API provider name
            session_id: Session identifier

        Returns:
            True if removed successfully
        """
        try:
            cache_key = f"{session_id}_{provider}"

            # Remove from memory cache
            self._memory_cache.pop(cache_key, None)
            self._models_cache.pop(cache_key, None)

            # Remove from encrypted database
            await self.credentials_db.delete_api_key(provider, session_id)

            logger.info(f"Removed API key for {provider}")
            return True

        except Exception as e:
            logger.error("Failed to remove API key", provider=provider, error=str(e))
            return False

    async def has_valid_key(self, provider: str, session_id: str = "default") -> bool:
        """Check if valid API key exists.

        Args:
            provider: API provider name
            session_id: Session identifier

        Returns:
            True if a valid key exists
        """
        api_key = await self.get_api_key(provider, session_id)
        return api_key is not None

    def clear_cache(self) -> None:
        """Clear all memory caches.

        Should be called on user logout to ensure decrypted keys
        don't persist in memory longer than necessary.
        """
        self._memory_cache.clear()
        self._models_cache.clear()
        self._oauth_cache.clear()
        logger.debug("Cleared all credential memory caches")

    # --- OAuth Token Methods ---

    async def store_oauth_tokens(
        self,
        provider: str,
        access_token: str,
        refresh_token: str,
        email: Optional[str] = None,
        name: Optional[str] = None,
        scopes: Optional[str] = None,
        customer_id: str = "owner"
    ) -> bool:
        """Store OAuth tokens in encrypted credentials database.

        Args:
            provider: OAuth provider name (e.g., 'google', 'twitter')
            access_token: OAuth access token
            refresh_token: OAuth refresh token
            email: User email or identifier
            name: User display name
            scopes: Comma-separated scopes
            customer_id: Customer identifier (default 'owner' for single-user)

        Returns:
            True if stored successfully
        """
        try:
            cache_key = f"{customer_id}_{provider}"

            await self.credentials_db.save_oauth_tokens(
                provider=provider,
                access_token=access_token,
                refresh_token=refresh_token,
                email=email,
                name=name,
                scopes=scopes,
                customer_id=customer_id
            )

            # Cache in memory
            self._oauth_cache[cache_key] = {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "email": email,
                "name": name,
                "scopes": scopes
            }

            logger.info(f"Stored OAuth tokens for {provider}")
            return True

        except Exception as e:
            logger.error("Failed to store OAuth tokens", provider=provider, error=str(e))
            return False

    async def get_oauth_tokens(
        self,
        provider: str,
        customer_id: str = "owner"
    ) -> Optional[Dict[str, Any]]:
        """Get OAuth tokens from cache or encrypted database.

        Args:
            provider: OAuth provider name
            customer_id: Customer identifier

        Returns:
            Dict with access_token, refresh_token, email, name, scopes or None
        """
        try:
            cache_key = f"{customer_id}_{provider}"

            # Check memory cache first
            if cache_key in self._oauth_cache:
                return self._oauth_cache[cache_key]

            # Fallback to encrypted database
            tokens = await self.credentials_db.get_oauth_tokens(provider, customer_id)
            if tokens:
                self._oauth_cache[cache_key] = tokens
                return tokens

            return None

        except Exception as e:
            logger.error("Failed to get OAuth tokens", provider=provider, error=str(e))
            return None

    async def remove_oauth_tokens(
        self,
        provider: str,
        customer_id: str = "owner"
    ) -> bool:
        """Remove OAuth tokens from storage and cache.

        Args:
            provider: OAuth provider name
            customer_id: Customer identifier

        Returns:
            True if removed successfully
        """
        try:
            cache_key = f"{customer_id}_{provider}"

            # Remove from memory cache
            self._oauth_cache.pop(cache_key, None)

            # Remove from encrypted database
            await self.credentials_db.delete_oauth_tokens(provider, customer_id)

            logger.info(f"Removed OAuth tokens for {provider}")
            return True

        except Exception as e:
            logger.error("Failed to remove OAuth tokens", provider=provider, error=str(e))
            return False
