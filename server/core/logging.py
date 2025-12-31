"""Modern structured logging configuration."""

import sys
import structlog
import logging
from pathlib import Path
from typing import Any, Dict
from core.config import Settings


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