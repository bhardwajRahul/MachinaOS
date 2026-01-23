"""Temporal workflow orchestration service.

This module provides Temporal integration for durable workflow execution.
LangGraph runs inside activities (outside Temporal's sandboxed event loop)
to use its native asyncio parallel execution.

When TEMPORAL_ENABLED=true:
- Workflows are executed via Temporal for durability
- LangGraph handles parallel execution inside activities
- Activities call back to MachinaOs node handlers

When TEMPORAL_ENABLED=false (default):
- Falls back to the existing Redis-based executor
"""

from .executor import TemporalExecutor
from .client import TemporalClientWrapper

__all__ = ["TemporalExecutor", "TemporalClientWrapper"]
