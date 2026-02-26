"""Modern structured logging configuration with WebSocket broadcasting."""

import sys
import asyncio
import structlog
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from queue import Queue
from threading import Thread
from core.config import Settings


class WebSocketLogHandler(logging.Handler):
    """Logging handler that broadcasts logs to WebSocket clients.

    Uses a thread-safe queue to bridge sync logging with async WebSocket broadcasting.
    A background thread processes the queue and uses asyncio to broadcast.
    """

    _instance: Optional['WebSocketLogHandler'] = None

    def __init__(self, level: int = logging.INFO):
        super().__init__(level)
        self._queue: Queue = Queue(maxsize=1000)  # Bounded queue to prevent memory issues
        self._running = False
        self._thread: Optional[Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        # Source name mapping for cleaner display
        self._source_map = {
            'services.workflow': 'workflow',
            'services.ai': 'ai',
            'services.android': 'android',
            'routers.whatsapp': 'whatsapp',
            'routers.android': 'android',
            'routers.websocket': 'websocket',
            'routers.workflow': 'workflow',
            'services.execution': 'execution',
            'services.deployment': 'deployment',
            '__main__': 'main',
            'main': 'main',
        }

    @classmethod
    def get_instance(cls) -> Optional['WebSocketLogHandler']:
        """Get the singleton instance."""
        return cls._instance

    def emit(self, record: logging.LogRecord) -> None:
        """Queue log record for async broadcasting."""
        if not self._running:
            return

        try:
            # Get the raw message without structlog formatting
            message = record.getMessage()

            # Map source name
            source = record.name
            for prefix, mapped in self._source_map.items():
                if source.startswith(prefix):
                    source = mapped
                    break

            # Extract structured key-value pairs from structlog
            details = None
            if hasattr(record, '_logger') or hasattr(record, 'positional_args'):
                # Try to get extra kwargs from structlog
                extra_keys = set(record.__dict__.keys()) - {
                    'name', 'msg', 'args', 'created', 'filename', 'funcName',
                    'levelname', 'levelno', 'lineno', 'module', 'msecs',
                    'pathname', 'process', 'processName', 'relativeCreated',
                    'stack_info', 'exc_info', 'exc_text', 'thread', 'threadName',
                    'message', 'asctime', 'positional_args', '_logger'
                }
                if extra_keys:
                    details = {k: record.__dict__[k] for k in extra_keys if not k.startswith('_')}

            # Create log entry
            log_data = {
                'timestamp': datetime.now().isoformat(),
                'level': record.levelname.lower(),
                'message': message,
                'source': source,
            }

            # Add details if present
            if details:
                log_data['details'] = details

            # Non-blocking put - drop if queue is full
            try:
                self._queue.put_nowait(log_data)
            except Exception:
                pass  # Drop log if queue is full

        except Exception:
            pass  # Never fail in log handler

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        """Start the background thread for processing logs."""
        if self._running:
            return

        self._loop = loop
        self._running = True
        self._thread = Thread(target=self._process_queue, daemon=True)
        self._thread.start()
        WebSocketLogHandler._instance = self

    def stop(self) -> None:
        """Stop the background thread."""
        self._running = False
        WebSocketLogHandler._instance = None
        if self._thread:
            self._thread.join(timeout=1.0)

    def _process_queue(self) -> None:
        """Background thread that processes log queue and broadcasts."""
        while self._running:
            try:
                # Block for up to 0.1 seconds waiting for logs
                try:
                    log_data = self._queue.get(timeout=0.1)
                except Exception:
                    continue

                # Schedule async broadcast on the event loop
                if self._loop and self._running:
                    asyncio.run_coroutine_threadsafe(
                        self._broadcast(log_data),
                        self._loop
                    )

            except Exception:
                pass  # Never fail in background thread

    async def _broadcast(self, log_data: Dict[str, Any]) -> None:
        """Broadcast log to WebSocket clients."""
        try:
            from services.status_broadcaster import get_status_broadcaster
            broadcaster = get_status_broadcaster()
            await broadcaster.broadcast_terminal_log(log_data)
        except Exception:
            pass  # Don't fail if broadcaster not ready


def configure_logging(settings: Settings) -> None:
    """Configure structured logging based on settings."""

    # Set up log file if specified
    if settings.log_file:
        log_path = Path(settings.log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        # Configure file handler
        file_handler = logging.FileHandler(log_path)
        file_handler.setLevel(getattr(logging, settings.log_level.upper()))

        # Configure console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, settings.log_level.upper()))

        # Configure root logger
        logging.basicConfig(
            level=getattr(logging, settings.log_level.upper()),
            handlers=[console_handler, file_handler],
            format="%(message)s"
        )
    else:
        # Console only
        logging.basicConfig(
            format="%(message)s",
            stream=sys.stdout,
            level=getattr(logging, settings.log_level.upper())
        )

    # Configure structlog
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    # Add appropriate renderer based on format
    if settings.log_format == "json":
        processors.insert(0, structlog.processors.TimeStamper(fmt="iso"))
        processors.insert(0, structlog.stdlib.add_logger_name)
        processors.append(structlog.processors.JSONRenderer())
    else:
        # Console format with timestamp
        processors.insert(0, structlog.processors.TimeStamper(fmt="%H:%M:%S"))
        processors.append(structlog.dev.ConsoleRenderer(
            colors=False,  # No ANSI colors for cleaner output
            pad_event=35,
            exception_formatter=structlog.dev.plain_traceback
        ))

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


def log_execution_time(logger: structlog.BoundLogger, operation: str,
                      start_time: float, end_time: float, **kwargs) -> None:
    """Log execution time with additional context."""
    execution_time = end_time - start_time
    logger.info(
        "Operation completed",
        operation=operation,
        execution_time_seconds=round(execution_time, 4),
        **kwargs
    )


def log_api_call(logger: structlog.BoundLogger, provider: str, model: str,
                operation: str, success: bool, **kwargs) -> None:
    """Log API calls with standardized format."""
    logger.info(
        "API call completed",
        provider=provider,
        model=model,
        operation=operation,
        success=success,
        **kwargs
    )


def log_cache_operation(logger: structlog.BoundLogger, operation: str,
                       key: str, hit: bool = None, **kwargs) -> None:
    """Log cache operations."""
    log_data = {
        "operation": operation,
        "cache_key": key,
        **kwargs
    }

    if hit is not None:
        log_data["cache_hit"] = hit

    logger.debug("Cache operation", **log_data)


# Global WebSocket log handler instance
_ws_log_handler: Optional[WebSocketLogHandler] = None


def setup_websocket_logging(loop: asyncio.AbstractEventLoop, level: int = logging.INFO) -> WebSocketLogHandler:
    """Setup and start the WebSocket log handler.

    Should be called during application startup after the event loop is running.

    Args:
        loop: The asyncio event loop to use for broadcasting
        level: Minimum log level to broadcast (default: INFO)

    Returns:
        The WebSocket log handler instance
    """
    global _ws_log_handler

    if _ws_log_handler is not None:
        return _ws_log_handler

    # Create handler
    _ws_log_handler = WebSocketLogHandler(level=level)

    # Add to root logger
    root_logger = logging.getLogger()
    root_logger.addHandler(_ws_log_handler)

    # Start the background processing thread
    _ws_log_handler.start(loop)

    return _ws_log_handler


def shutdown_websocket_logging() -> None:
    """Shutdown the WebSocket log handler.

    Should be called during application shutdown.
    """
    global _ws_log_handler

    if _ws_log_handler is None:
        return

    # Stop the handler
    _ws_log_handler.stop()

    # Remove from root logger
    root_logger = logging.getLogger()
    root_logger.removeHandler(_ws_log_handler)

    _ws_log_handler = None


def get_websocket_log_handler() -> Optional[WebSocketLogHandler]:
    """Get the current WebSocket log handler instance."""
    return _ws_log_handler