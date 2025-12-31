"""
Modern FastAPI backend for React Flow workflow automation platform.

Refactored with dependency injection, modular services, and clean architecture.
"""

# Performance: Install uvloop if available (Linux/macOS only)
try:
    import uvloop
    uvloop.install()
except ImportError:
    pass  # Windows - uvloop not available, use default asyncio

from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from core.container import container
from core.config import Settings
from core.logging import configure_logging, get_logger
from routers import workflow, database, maps, nodejs_compat, android, websocket, webhook, auth

# Initialize settings and logging
settings = Settings()
configure_logging(settings)
logger = get_logger(__name__)

# Suppress noisy loggers
import logging
logging.getLogger("apscheduler").setLevel(logging.WARNING)
logging.getLogger("apscheduler.scheduler").setLevel(logging.WARNING)
logging.getLogger("apscheduler.executors").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
logging.getLogger("watchfiles").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    # Startup
    logger.info("Starting React Flow Python Services")

    # Wire dependency injection
    container.wire(modules=[
        "routers.workflow",
        "routers.database",
        "routers.maps",
        "routers.nodejs_compat",
        "routers.android",
        "routers.websocket",
        "routers.webhook",
        "routers.auth",
        "middleware.auth"
    ])

    # Start services
    await container.database().startup()
    await container.cache().startup()

    # Initialize event waiter with cache service for Redis Streams support
    from services import event_waiter
    event_waiter.set_cache_service(container.cache())

    # Start APScheduler for cron jobs
    from services.scheduler import start_scheduler, shutdown_scheduler
    start_scheduler()

    # Initialize execution engine recovery sweeper
    from services.execution import (
        ExecutionCache,
        RecoverySweeper,
        set_recovery_sweeper,
    )
    execution_cache = ExecutionCache(container.cache())
    recovery_sweeper = RecoverySweeper(execution_cache)
    set_recovery_sweeper(recovery_sweeper)

    # Scan for incomplete executions on startup
    if settings.redis_enabled:
        incomplete = await recovery_sweeper.scan_on_startup()
        if incomplete:
            logger.info("Found incomplete executions on startup",
                       count=len(incomplete),
                       execution_ids=incomplete)

        # Start background recovery sweeper
        await recovery_sweeper.start()
        logger.info("Execution recovery sweeper started")

    logger.info("Services started successfully")
    yield

    # Shutdown
    # Stop recovery sweeper first
    if settings.redis_enabled:
        await recovery_sweeper.stop()
        logger.info("Execution recovery sweeper stopped")

    shutdown_scheduler()  # Stop APScheduler
    await container.cache().shutdown()
    await container.database().shutdown()
    logger.info("Services shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="React Flow Python Services",
    version="3.0.0",
    description="Modern workflow automation backend with AI and Maps integration",
    lifespan=lifespan,
    default_response_class=ORJSONResponse
)

# Add exception handler middleware BEFORE CORS to catch all errors
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

class CatchAllExceptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Unhandled exception: {type(e).__name__}: {str(e)}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "success": False,
                    "error": f"{type(e).__name__}: {str(e)}",
                    "detail": "Internal server error"
                }
            )

app.add_middleware(CatchAllExceptionsMiddleware)

# Add Auth middleware (checks JWT cookie for protected routes)
from middleware.auth import AuthMiddleware
app.add_middleware(AuthMiddleware)

# Add CORS middleware (must be AFTER exception middleware)
logger.info("Configuring CORS middleware",
           origins_count=len(settings.cors_origins),
           origins=settings.cors_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router)  # Auth routes (login, register, logout, status)
app.include_router(nodejs_compat.router)  # Node.js compatibility (includes root endpoints)
app.include_router(workflow.router)
app.include_router(database.router)
app.include_router(maps.router)
app.include_router(android.router)
app.include_router(websocket.router)
app.include_router(webhook.router)


@app.get("/health")
async def health_check():
    """Detailed health check."""
    from services import event_waiter
    from services.execution import get_recovery_sweeper

    sweeper = get_recovery_sweeper()

    return {
        "status": "OK",
        "service": "python",
        "version": "3.1.0",  # Bumped for execution engine
        "environment": "development" if settings.debug else "production",
        "redis_enabled": settings.redis_enabled,
        "event_waiter_mode": event_waiter.get_backend_mode(),
        "execution_engine": {
            "enabled": settings.redis_enabled,
            "recovery_sweeper": sweeper is not None and sweeper._running,
        },
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting React Flow Python Services",
               host=settings.host, port=settings.port, debug=settings.debug)
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        reload_dirs=["."] if settings.debug else None,
        reload_excludes=["*.pyc", "__pycache__", "*.log", "*.db"] if settings.debug else None,
        workers=1 if settings.debug else settings.workers
    )