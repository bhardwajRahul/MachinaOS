"""Temporal workflow orchestration service.

This module provides Temporal integration for durable distributed workflow execution.

Architecture:
- Each workflow node executes as an independent Temporal activity
- Activities can run on ANY worker in the cluster for horizontal scaling
- Workflow only orchestrates - schedules activities and routes outputs
- WebSocket connection to MachinaOs for low-latency node execution

When TEMPORAL_ENABLED=true:
- Workflows are executed via Temporal for durability and distribution
- Each node is a separate activity with its own retry policy
- Parallel branches execute concurrently on available workers

When TEMPORAL_ENABLED=false (default):
- Falls back to the existing parallel/sequential executor
"""

from .executor import TemporalExecutor
from .client import TemporalClientWrapper

__all__ = ["TemporalExecutor", "TemporalClientWrapper"]
