"""Helpers for thin-delegating document plugins to their handlers."""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict


async def delegate(
    handler: Callable[..., Awaitable[Dict[str, Any]]],
    *,
    node_type: str,
    node_id: str,
    payload: Dict[str, Any],
    context: Dict[str, Any],
) -> Any:
    response = await handler(
        node_id=node_id, node_type=node_type,
        parameters=payload, context=context,
    )
    if response.get("success"):
        return response.get("result") or response
    raise RuntimeError(response.get("error") or f"{node_type} failed")
