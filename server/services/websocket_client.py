"""
Android WebSocket Client - DEPRECATED

This module is deprecated. Use services.android instead:

    from services.android import (
        RelayWebSocketClient,
        get_relay_client,
        close_relay_client,
        get_current_relay_client,
    )

This file re-exports from the new module for backwards compatibility.
"""

from services.android import (
    RelayWebSocketClient,
    get_relay_client,
    close_relay_client,
    get_current_relay_client,
)

# Re-export for backwards compatibility
__all__ = [
    "RelayWebSocketClient",
    "get_relay_client",
    "close_relay_client",
    "get_current_relay_client",
]
