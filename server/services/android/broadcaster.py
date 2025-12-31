"""
Android Status Broadcaster

Broadcasts Android relay connection status changes to frontend WebSocket clients.
"""
from typing import Optional, Set
import structlog

logger = structlog.get_logger()


async def broadcast_android_status(
    connected: bool,
    paired: bool = False,
    device_id: Optional[str] = None,
    device_name: Optional[str] = None,
    devices: Optional[Set[str]] = None,
    qr_data: Optional[str] = None,
    session_token: Optional[str] = None
):
    """
    Broadcast Android relay status changes to frontend WebSocket clients.

    Args:
        connected: Whether connected to relay server
        paired: Whether paired with Android device
        device_id: Paired device ID (if any)
        device_name: Paired device name (if any)
        devices: Set of all connected device IDs
        qr_data: QR code data for pairing (app://pair?token=...)
        session_token: Relay session token
    """
    try:
        from services.status_broadcaster import get_status_broadcaster
        broadcaster = get_status_broadcaster()
        await broadcaster.update_android_status(
            connected=connected,
            paired=paired,
            device_id=device_id,
            device_name=device_name,
            connected_devices=list(devices) if devices else [],
            connection_type="relay" if connected else None,
            qr_data=qr_data,
            session_token=session_token
        )
    except Exception as e:
        logger.warning("[Android] Failed to broadcast status", error=str(e))


async def broadcast_connected(device_id: str, device_name: Optional[str] = None):
    """Broadcast that Android device is paired"""
    await broadcast_android_status(
        connected=True,
        paired=True,
        device_id=device_id,
        device_name=device_name,
        devices={device_id} if device_id else set()
    )


async def broadcast_device_disconnected(
    relay_connected: bool = True,
    qr_data: Optional[str] = None,
    session_token: Optional[str] = None
):
    """Broadcast that Android device is disconnected (but relay may still be connected).

    This is called when the Android device unpairs. The relay connection may still be active.
    Use broadcast_relay_disconnected() when the relay connection itself is closed.

    Args:
        relay_connected: Whether the relay WebSocket is still connected
        qr_data: QR code data for re-pairing
        session_token: Current session token
    """
    await broadcast_android_status(
        connected=relay_connected,  # Relay may still be connected
        paired=False,  # Device is disconnected
        device_id=None,
        device_name=None,
        devices=set(),
        qr_data=qr_data,  # Keep QR data for re-pairing
        session_token=session_token
    )


async def broadcast_relay_disconnected():
    """Broadcast that relay connection is closed (fully disconnected)"""
    await broadcast_android_status(
        connected=False,
        paired=False,
        device_id=None,
        device_name=None,
        devices=set()
    )


# Legacy alias for backwards compatibility
async def broadcast_disconnected():
    """Legacy alias - use broadcast_device_disconnected or broadcast_relay_disconnected instead"""
    await broadcast_relay_disconnected()


async def broadcast_qr_code(qr_data: str, session_token: Optional[str] = None):
    """Broadcast QR code for pairing"""
    await broadcast_android_status(
        connected=True,  # Connected to relay but not paired
        paired=False,
        device_id=None,
        device_name=None,
        devices=set(),
        qr_data=qr_data,
        session_token=session_token
    )
