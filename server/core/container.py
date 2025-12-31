"""Dependency injection container for the application."""

from dependency_injector import containers, providers
from dependency_injector.wiring import Provide, inject

from core.config import Settings
from core.database import Database
from core.cache import CacheService
from services.ai import AIService
from services.maps import MapsService
from services.workflow import WorkflowService
from services.auth import AuthService
from services.text import TextService
from services.android_service import AndroidService
from services.user_auth import UserAuthService


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

    # Services
    auth_service = providers.Factory(
        AuthService,
        cache=cache,
        database=database,
        settings=settings
    )

    user_auth_service = providers.Factory(
        UserAuthService,
        database=database,
        settings=settings
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