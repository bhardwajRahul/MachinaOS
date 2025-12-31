"""Simple API key management service."""

import hashlib
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

from core.config import Settings
from core.database import Database
from core.cache import CacheService
from core.logging import get_logger

logger = get_logger(__name__)


class AuthService:
    """Simple API key management service."""

    def __init__(self, database: Database, cache: CacheService, settings: Settings):
        self.database = database
        self.cache = cache
        self.settings = settings

    def encrypt_api_key(self, api_key: str) -> str:
        """Simple base64 encoding (compatible with frontend)."""
        return base64.b64encode(api_key.encode()).decode()

    def decrypt_api_key(self, encrypted_key: str) -> str:
        """Simple base64 decoding."""
        try:
            return base64.b64decode(encrypted_key.encode()).decode()
        except Exception:
            return ""

    def hash_api_key(self, api_key: str) -> str:
        """Create hash for API key identification."""
        return hashlib.sha256(api_key.encode()).hexdigest()[:16]

    async def store_api_key(self, provider: str, api_key: str, models: List[str],
                          session_id: str = "default") -> bool:
        """Store API key with models."""
        try:
            key_id = f"{session_id}_{provider}"
            encrypted_key = self.encrypt_api_key(api_key)
            key_hash = self.hash_api_key(api_key)

            logger.info(f"Storing API key for provider: {provider}, session: {session_id}, key_id: {key_id}")

            # Store in database
            success = await self.database.save_api_key(
                key_id=key_id,
                provider=provider,
                session_id=session_id,
                key_encrypted=encrypted_key,
                key_hash=key_hash,
                models=models
            )

            logger.info(f"Database save result: {success}")

            # Cache for quick access
            if success:
                cache_data = {
                    "encrypted_key": encrypted_key,
                    "models": models,
                    "last_validated": datetime.utcnow().isoformat()
                }
                await self.cache.cache_api_key(provider, session_id, cache_data)
                logger.info(f"Cached API key for {provider}")

            return success

        except Exception as e:
            logger.error("Failed to store API key", provider=provider, error=str(e))
            return False

    async def get_api_key(self, provider: str, session_id: str = "default") -> Optional[str]:
        """Get decrypted API key."""
        try:
            # Try cache first
            cached_data = await self.cache.get_cached_api_key(provider, session_id)
            if cached_data:
                return self.decrypt_api_key(cached_data["encrypted_key"])

            # Fallback to database
            api_key_record = await self.database.get_api_key_by_provider(provider, session_id)
            if api_key_record and api_key_record.is_valid:
                # Check if not expired (30 days)
                if datetime.utcnow() - api_key_record.last_validated < timedelta(days=30):
                    return self.decrypt_api_key(api_key_record.key_encrypted)

            return None

        except Exception as e:
            logger.error("Failed to get API key", provider=provider, error=str(e))
            return None

    async def get_stored_models(self, provider: str, session_id: str = "default") -> List[str]:
        """Get stored models for provider."""
        try:
            # Try cache first
            cached_data = await self.cache.get_cached_api_key(provider, session_id)
            if cached_data and cached_data.get("models"):
                return cached_data["models"]

            # Fallback to database
            api_key_record = await self.database.get_api_key_by_provider(provider, session_id)
            if api_key_record and api_key_record.models:
                return api_key_record.models.get("models", [])

            return []

        except Exception as e:
            logger.error("Failed to get stored models", provider=provider, error=str(e))
            return []

    async def remove_api_key(self, provider: str, session_id: str = "default") -> bool:
        """Remove API key."""
        try:
            # Remove from cache and database
            await self.cache.remove_cached_api_key(provider, session_id)
            return await self.database.delete_api_key(provider, session_id)

        except Exception as e:
            logger.error("Failed to remove API key", provider=provider, error=str(e))
            return False

    async def has_valid_key(self, provider: str, session_id: str = "default") -> bool:
        """Check if valid API key exists."""
        api_key = await self.get_api_key(provider, session_id)
        return api_key is not None