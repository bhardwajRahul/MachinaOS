"""Dependency injection container for the application."""

from dependency_injector import containers, providers

from core.config import Settings
from core.database import Database
from core.cache import CacheService
from core.encryption import EncryptionService
from core.credentials_database import CredentialsDatabase
from services.ai import AIService
from services.maps import MapsService
from services.workflow import WorkflowService
from services.auth import AuthService
from services.text import TextService
from services.android_service import AndroidService
from services.user_auth import UserAuthService
from services.compaction import init_compaction_service

# Temporal is optional - import with fallback
try:
    from services.temporal import TemporalClientWrapper
    _TEMPORAL_AVAILABLE = True
except ImportError:
    TemporalClientWrapper = None
    _TEMPORAL_AVAILABLE = False


def _create_temporal_client(server_address: str, namespace: str):
    """Factory function for temporal client - returns None if not available."""
    if not _TEMPORAL_AVAILABLE or TemporalClientWrapper is None:
        return None
    return TemporalClientWrapper(server_address=server_address, namespace=namespace)


class Container(containers.DeclarativeContainer):
    """Application dependency injection container."""

    # Configuration
    config = providers.Configuration()

    # Settings
    settings = providers.Singleton(
        Settings,
    )

    # Database (needed by CacheService for SQLite fallback)
    database = providers.Singleton(
        Database,
        settings=settings
    )

    # Cache service (uses Redis when available, SQLite otherwise)
    cache = providers.Singleton(
        CacheService,
        settings=settings,
        database=database
    )

    # Encryption service for credentials (initialized on user login)
    encryption_service = providers.Singleton(
        EncryptionService
    )

    # Credentials database (separate encrypted database for API keys and OAuth tokens)
    credentials_database = providers.Singleton(
        CredentialsDatabase,
        db_path=settings.provided.credentials_db_path,
        encryption=encryption_service
    )

    # Temporal client (lazy - returns None if temporalio not installed)
    temporal_client = providers.Singleton(
        _create_temporal_client,
        server_address=settings.provided.temporal_server_address,
        namespace=settings.provided.temporal_namespace,
    )

    # Services
    auth_service = providers.Factory(
        AuthService,
        credentials_db=credentials_database,
        cache=cache,
        database=database,
        settings=settings
    )

    user_auth_service = providers.Factory(
        UserAuthService,
        database=database,
        settings=settings,
        encryption=encryption_service,
        credentials_db=credentials_database
    )

    ai_service = providers.Factory(
        AIService,
        auth_service=auth_service,
        database=database,
        cache=cache,
        settings=settings
    )

    maps_service = providers.Factory(
        MapsService,
        auth_service=auth_service,
        settings=settings
    )

    text_service = providers.Factory(
        TextService
    )

    android_service = providers.Factory(
        AndroidService
    )

    compaction_service = providers.Singleton(
        init_compaction_service,
        database=database,
        settings=settings
    )

    workflow_service = providers.Singleton(
        WorkflowService,
        database=database,
        ai_service=ai_service,
        maps_service=maps_service,
        text_service=text_service,
        android_service=android_service,
        cache=cache,
        settings=settings
    )


# Global container instance
container = Container()