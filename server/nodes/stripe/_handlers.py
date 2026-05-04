"""Stripe WebSocket handlers — built from the framework lifecycle factory.

Only ``stripe_trigger`` (synthetic test events via the CLI) is
plugin-specific; the other 4 lifecycle handlers come from
:func:`services.events.make_lifecycle_handlers`.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import WebSocket

from services.events import make_lifecycle_handlers, run_cli_command

from ._credentials import StripeCredential
from ._source import get_listen_source


async def handle_stripe_trigger(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Run ``stripe trigger <event>`` for synthetic test events."""
    event = data.get("event")
    if not event:
        return {"success": False, "error": "event required (e.g. 'charge.succeeded')"}
    return await run_cli_command(
        binary="stripe", argv=["trigger", event], credential=StripeCredential,
    )


WS_HANDLERS = make_lifecycle_handlers(
    prefix="stripe",
    source=get_listen_source(),
    extra={"stripe_trigger": handle_stripe_trigger},
)
