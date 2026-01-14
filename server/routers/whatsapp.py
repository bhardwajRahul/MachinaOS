"""
WhatsApp Service - JSON-RPC 2.0 integration with Go whatsmeow service.

This module provides WebSocket handlers for WhatsApp operations.
All communication goes through the RPCClient to the Go service.
"""

import asyncio
import base64
import io
import json
import logging
import os
import time
from typing import Any, Optional

import qrcode
import websockets
from websockets.exceptions import ConnectionClosed
from fastapi import HTTPException


def qr_code_to_base64(code: str) -> str:
    """Convert QR code string to base64 PNG image."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(code)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


logger = logging.getLogger(__name__)

WHATSAPP_RPC_URL = os.getenv("WHATSAPP_RPC_URL", "ws://localhost:9400/ws/rpc")


# Inline RPC Client with async event handling
class RPCClient:
    def __init__(self, url: str):
        self.url, self.ws, self.req_id = url, None, 0
        self.pending: dict[int, asyncio.Future] = {}
        self._connected, self._task = False, None
        self._event_handler = None

    @property
    def connected(self):
        """Check if actually connected - verify WebSocket is open."""
        if not self._connected or not self.ws:
            return False
        # websockets 15.x uses state instead of closed (state.value: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
        try:
            return self.ws.state.value == 1
        except Exception:
            return False

    def set_event_handler(self, handler):
        """Set callback for handling async events from Go service."""
        self._event_handler = handler

    async def connect(self):
        # 2 second timeout for initial connection (fail fast if Go service not running)
        logger.info(f"[WhatsApp RPC] Connecting to {self.url}...")
        self.ws = await asyncio.wait_for(
            websockets.connect(self.url, ping_interval=30, max_size=100*1024*1024),
            timeout=2.0
        )
        self._connected = True
        logger.info("[WhatsApp RPC] WebSocket connected, starting receive loop")
        self._task = asyncio.create_task(self._recv())

    async def close(self):
        self._connected = False
        if self._task: self._task.cancel()
        if self.ws: await self.ws.close()

    async def _recv(self):
        try:
            logger.info("[WhatsApp RPC] Receive loop started")
            async for msg in self.ws:
                data = json.loads(msg)
                logger.debug(f"[WhatsApp RPC] Received: {data.get('method', data.get('id', 'unknown'))}")
                if data.get("id") in self.pending:
                    self.pending[data["id"]].set_result(data)
                elif "method" in data and "id" not in data:
                    await self._handle_event(data)
        except ConnectionClosed as e:
            logger.warning(f"[WhatsApp RPC] Connection closed: {e}")
            self._connected = False
        except Exception as e:
            logger.error(f"[WhatsApp RPC] Receive loop error: {e}")
            self._connected = False

    async def _handle_event(self, data: dict):
        """Handle async events from Go service and broadcast to frontend.

        Events from schema.json:
        - event.connected: {status: "connected", device_id: string}
        - event.disconnected: {status: "disconnected", reason: string}
        - event.connection_failure: {error: string, reason: string}
        - event.logged_out: {on_connect: boolean, reason: string}
        - event.temporary_ban: {code: string, reason: string}
        - event.qr_code: {code: string, filename: string}
        - event.message_sent: {message_id, to, type, timestamp}
        - event.message_received: {message_id, sender, chat_id, ...}
        """
        method = data.get("method", "")
        params = data.get("params", {})
        logger.debug(f"[WhatsApp RPC] Event: {method}")

        try:
            from services.status_broadcaster import get_status_broadcaster
            broadcaster = get_status_broadcaster()

            if method == "event.status":
                # Initial status sent on WebSocket connection
                await broadcaster.update_whatsapp_status(
                    connected=params.get("connected", False),
                    has_session=params.get("has_session", False),
                    running=params.get("running", False),
                    pairing=params.get("pairing", False),
                    device_id=params.get("device_id"),
                    qr=None
                )

            elif method == "event.connected":
                # Connected successfully with device_id
                await broadcaster.update_whatsapp_status(
                    connected=True,
                    has_session=True,
                    running=True,
                    pairing=False,
                    device_id=params.get("device_id"),
                    qr=None
                )

            elif method == "event.disconnected":
                # Disconnected - service still running
                await broadcaster.update_whatsapp_status(
                    connected=False,
                    has_session=False,
                    running=True,
                    pairing=False,
                    device_id=None,
                    qr=None
                )

            elif method == "event.connection_failure":
                # Connection failed
                logger.error(f"[WhatsApp] Connection failure: {params.get('error')} - {params.get('reason')}")
                await broadcaster.update_whatsapp_status(
                    connected=False,
                    has_session=False,
                    running=True,
                    pairing=False,
                    device_id=None,
                    qr=None
                )

            elif method == "event.logged_out":
                # Logged out - session cleared
                logger.warning(f"[WhatsApp] Logged out: {params.get('reason')}")
                await broadcaster.update_whatsapp_status(
                    connected=False,
                    has_session=False,
                    running=True,
                    pairing=False,
                    device_id=None,
                    qr=None
                )

            elif method == "event.temporary_ban":
                # Temporary ban
                logger.error(f"[WhatsApp] Temporary ban: code={params.get('code')} reason={params.get('reason')}")
                await broadcaster.update_whatsapp_status(
                    connected=False,
                    has_session=False,
                    running=True,
                    pairing=False,
                    device_id=None,
                    qr=None
                )

            elif method == "event.qr_code":
                # New QR code available for pairing
                code = params.get("code")
                qr_image = qr_code_to_base64(code) if code else None
                await broadcaster.update_whatsapp_status(
                    connected=False,
                    has_session=False,
                    running=True,
                    pairing=True,
                    device_id=None,
                    qr=qr_image
                )

            elif method == "event.message_sent":
                # Message sent - broadcast as custom event
                await broadcaster.send_custom_event("whatsapp_message_sent", params)

            elif method == "event.message_received":
                # Message received - broadcast as custom event for trigger nodes
                await broadcaster.send_custom_event("whatsapp_message_received", params)

            # Forward to custom handler if set
            if self._event_handler:
                await self._event_handler(method, params)

        except Exception as e:
            logger.error(f"[WhatsApp RPC] Event handler error: {e}")

    async def call(self, method: str, params: Any = None, timeout: float = 30) -> Any:
        if not self.connected:
            raise Exception("Not connected to WhatsApp service")
        self.req_id += 1
        req_id = self.req_id  # Capture request ID before any await
        req = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params:
            req["params"] = params

        # Get current event loop for future
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
        future = loop.create_future()
        self.pending[req_id] = future

        try:
            await self.ws.send(json.dumps(req))
            resp = await asyncio.wait_for(future, timeout)
            if resp.get("error"):
                raise Exception(resp["error"].get("message", "RPC Error"))
            return resp.get("result")
        except asyncio.TimeoutError:
            raise Exception(f"RPC call '{method}' timed out after {timeout}s")
        except ConnectionClosed as e:
            logger.error(f"[WhatsApp RPC] Connection closed during {method}: {e}")
            self._connected = False
            raise Exception(f"Connection lost during {method}")
        finally:
            self.pending.pop(req_id, None)

_client: Optional[RPCClient] = None
_lock = asyncio.Lock()
_send_lock = asyncio.Lock()  # Serialize sends - Go service processes sequentially


async def reset_client():
    """Force reset the RPC client connection."""
    global _client
    async with _lock:
        if _client:
            try:
                await _client.close()
            except Exception:
                pass
            _client = None


async def get_client(force_reconnect: bool = False) -> RPCClient:
    """Get or create RPC client. Use force_reconnect=True to ensure fresh connection."""
    global _client
    async with _lock:
        # Force reconnect if requested or if client is stale
        if force_reconnect and _client:
            logger.info("[WhatsApp RPC] Force reconnecting...")
            try:
                await _client.close()
            except Exception:
                pass
            _client = None

        if not _client or not _client.connected:
            logger.info(f"[WhatsApp RPC] Creating new connection to {WHATSAPP_RPC_URL}")
            _client = RPCClient(WHATSAPP_RPC_URL)
            try:
                await _client.connect()
                logger.info("[WhatsApp RPC] Connected successfully")
            except asyncio.TimeoutError:
                _client = None
                logger.error(f"WhatsApp RPC timeout - Go service not responding at {WHATSAPP_RPC_URL}")
                raise Exception("WhatsApp service timeout - is Go service running?")
            except (ConnectionRefusedError, OSError) as e:
                _client = None
                logger.error(f"WhatsApp RPC connection refused: {e}")
                raise Exception("WhatsApp service not running - start Go whatsmeow service on port 9400")
            except Exception as e:
                _client = None
                logger.error(f"WhatsApp RPC error: {e}")
                raise Exception(f"WhatsApp connection failed: {e}")
        return _client


# ============================================================================
# WebSocket Handlers - used by websocket.py
# ============================================================================

async def handle_whatsapp_status() -> dict:
    """Get WhatsApp connection status via direct RPC and broadcast to all clients."""
    try:
        client = await get_client()
        status_data = await client.call("status")

        # Broadcast status update to all connected WebSocket clients
        from services.status_broadcaster import get_status_broadcaster
        broadcaster = get_status_broadcaster()
        await broadcaster.update_whatsapp_status(
            connected=status_data.get("connected", False),
            has_session=status_data.get("has_session", False),
            running=status_data.get("running", False),
            pairing=status_data.get("pairing", False),
            device_id=status_data.get("device_id"),
            qr=None  # QR code comes from event.qr_code events
        )

        return {
            "success": True,
            "data": status_data,
            "connected": status_data.get("connected", False),
            "device_id": status_data.get("device_id"),
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"WhatsApp status check failed: {e}")
        # Return error response immediately - don't broadcast here to avoid race conditions
        # The client will update its local state based on the error response
        return {
            "success": False,
            "error": str(e),
            "connected": False,
            "running": False,
            "timestamp": time.time()
        }


async def handle_whatsapp_qr() -> dict:
    """Get WhatsApp QR code for authentication via direct RPC."""
    try:
        client = await get_client()
        status = await client.call("status")

        if status.get("connected") and status.get("has_session"):
            return {
                "success": True,
                "connected": True,
                "message": "Already connected with active session",
                "timestamp": time.time()
            }

        try:
            result = await client.call("qr")
            code = result.get("code")
            if code:
                qr_image = qr_code_to_base64(code)
                return {
                    "success": True,
                    "connected": False,
                    "qr": qr_image,
                    "message": "QR code available",
                    "timestamp": time.time()
                }
            return {
                "success": True,
                "connected": False,
                "qr": None,
                "message": "No QR code available",
                "timestamp": time.time()
            }
        except Exception as qr_err:
            return {
                "success": True,
                "connected": False,
                "qr": None,
                "message": str(qr_err),
                "timestamp": time.time()
            }
    except Exception as e:
        logger.error(f"WhatsApp QR fetch failed: {e}")
        return {"success": False, "connected": False, "error": str(e)}


async def handle_whatsapp_send(params: dict) -> dict:
    """Send a WhatsApp message via direct RPC - supports all message types.

    Uses _send_lock to serialize sends - Go service processes sequentially.

    Params from frontend node:
    - recipientType: 'phone' or 'group'
    - phone: recipient phone number (if recipientType='phone')
    - group_id: group JID (if recipientType='group')
    - messageType: text, image, video, audio, document, sticker, location, contact
    - message: text content (for text type)
    - mediaSource: base64, file, url (for media types)
    - mediaData/filePath/mediaUrl: media content based on source
    - mimeType, caption, filename: media options
    - latitude, longitude, locationName, address: location data
    - contactName, vcard: contact data
    - isReply, replyMessageId, replySender, replyContent: reply context
    """
    async with _send_lock:
        try:
            # Build RPC params matching schema.json
            rpc_params: dict[str, Any] = {}

            # Recipient
            recipient_type = params.get("recipientType", "phone")
            if recipient_type == "group":
                group_id = params.get("group_id")
                if not group_id:
                    return {"success": False, "error": "group_id is required"}
                rpc_params["group_id"] = group_id
            else:
                phone = params.get("phone")
                if not phone:
                    return {"success": False, "error": "phone is required"}
                rpc_params["phone"] = phone

            # Message type
            msg_type = params.get("messageType", "text")
            rpc_params["type"] = msg_type

            # Content based on type
            if msg_type == "text":
                message = params.get("message")
                if not message:
                    return {"success": False, "error": "message is required for text type"}
                rpc_params["message"] = message

            elif msg_type in ["image", "video", "audio", "document", "sticker"]:
                media_source = params.get("mediaSource", "base64")
                media_data = None
                mime_type = params.get("mimeType")
                filename = params.get("filename")

                if media_source == "base64":
                    media_data = params.get("mediaData")
                elif media_source == "file":
                    file_param = params.get("filePath")
                    if isinstance(file_param, dict) and file_param.get("type") == "upload":
                        media_data = file_param.get("data")
                        mime_type = mime_type or file_param.get("mimeType")
                        filename = filename or file_param.get("filename")
                    elif file_param:
                        import base64 as b64
                        try:
                            with open(file_param, "rb") as f:
                                media_data = b64.b64encode(f.read()).decode("utf-8")
                        except Exception as e:
                            return {"success": False, "error": f"Failed to read file: {e}"}
                elif media_source == "url":
                    media_url = params.get("mediaUrl")
                    if media_url:
                        import httpx
                        import base64 as b64
                        try:
                            async with httpx.AsyncClient() as http:
                                resp = await http.get(media_url, timeout=30)
                                media_data = b64.b64encode(resp.content).decode("utf-8")
                        except Exception as e:
                            return {"success": False, "error": f"Failed to download media: {e}"}

                if not media_data:
                    return {"success": False, "error": f"media data is required for {msg_type} type"}

                rpc_params["media_data"] = {
                    "data": media_data,
                    "mime_type": mime_type or _guess_mime_type(msg_type)
                }
                if params.get("caption"):
                    rpc_params["media_data"]["caption"] = params["caption"]
                final_filename = filename or params.get("filename")
                if final_filename:
                    rpc_params["media_data"]["filename"] = final_filename

            elif msg_type == "location":
                lat = params.get("latitude")
                lng = params.get("longitude")
                if lat is None or lng is None:
                    return {"success": False, "error": "latitude and longitude are required"}
                rpc_params["location"] = {"latitude": float(lat), "longitude": float(lng)}
                if params.get("locationName"):
                    rpc_params["location"]["name"] = params["locationName"]
                if params.get("address"):
                    rpc_params["location"]["address"] = params["address"]

            elif msg_type == "contact":
                contact_name = params.get("contactName")
                vcard = params.get("vcard")
                if not contact_name or not vcard:
                    return {"success": False, "error": "contactName and vcard are required"}
                rpc_params["contact"] = {"display_name": contact_name, "vcard": vcard}

            # Reply context
            if params.get("isReply"):
                reply_id = params.get("replyMessageId")
                reply_sender = params.get("replySender")
                if reply_id and reply_sender:
                    rpc_params["reply"] = {
                        "message_id": reply_id,
                        "sender": reply_sender,
                        "content": params.get("replyContent", "")
                    }

            if params.get("metadata"):
                rpc_params["metadata"] = params["metadata"]

            client = await get_client()
            result = await client.call("send", rpc_params)
            return {
                "success": True,
                "messageId": result.get("message_id"),
                "messageType": msg_type,
                "timestamp": time.time()
            }
        except Exception as e:
            logger.error(f"WhatsApp send failed: {e}")
            return {"success": False, "error": str(e)}


def _guess_mime_type(msg_type: str) -> str:
    """Guess default MIME type based on message type."""
    defaults = {
        "image": "image/jpeg",
        "video": "video/mp4",
        "audio": "audio/ogg",
        "document": "application/octet-stream",
        "sticker": "image/webp"
    }
    return defaults.get(msg_type, "application/octet-stream")


async def handle_whatsapp_start() -> dict:
    """Start WhatsApp connection via direct RPC and broadcast running state."""
    try:
        client = await get_client()
        result = await client.call("start")

        # Broadcast that service is now running (waiting for QR or connection)
        from services.status_broadcaster import get_status_broadcaster
        broadcaster = get_status_broadcaster()
        await broadcaster.update_whatsapp_status(
            connected=False,
            has_session=False,
            running=True,
            pairing=False,  # Will be set to True by event.qr_code event
            device_id=None,
            qr=None
        )

        return {
            "success": True,
            "message": "WhatsApp connection started",
            "data": result,
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"WhatsApp start failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_whatsapp_restart() -> dict:
    """Restart WhatsApp connection via direct RPC.

    This calls the 'restart' RPC method which stops and starts the service,
    unlike 'start' which only starts if not running.
    """
    try:
        # Force fresh connection to avoid stale WebSocket
        client = await get_client(force_reconnect=True)

        # Broadcast that we're restarting (brief disconnected state)
        from services.status_broadcaster import get_status_broadcaster
        broadcaster = get_status_broadcaster()
        await broadcaster.update_whatsapp_status(
            connected=False,
            has_session=False,
            running=True,
            pairing=False,
            device_id=None,
            qr=None
        )

        # Call restart RPC method
        result = await client.call("restart")

        return {
            "success": True,
            "message": "WhatsApp connection restarted",
            "data": result,
            "timestamp": time.time()
        }
    except HTTPException as e:
        logger.error(f"WhatsApp restart failed: {e.detail}")
        return {"success": False, "error": e.detail}
    except Exception as e:
        logger.error(f"WhatsApp restart failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_whatsapp_groups() -> dict:
    """Get list of WhatsApp groups via direct RPC."""
    try:
        client = await get_client()
        groups = await client.call("groups")

        return {
            "success": True,
            "groups": groups or [],
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"WhatsApp groups fetch failed: {e}")
        return {"success": False, "error": str(e), "groups": []}


async def handle_whatsapp_group_info(group_id: str) -> dict:
    """Get group info including participants with resolved phone numbers.

    Args:
        group_id: Group JID (e.g., '120363422738675920@g.us')

    Returns:
        Group info with participants containing both 'jid' (LID) and 'phone' (resolved number)
    """
    try:
        if not group_id:
            return {"success": False, "error": "group_id is required", "participants": []}

        client = await get_client()
        result = await client.call("group_info", {"group_id": group_id})

        if not result:
            return {"success": False, "error": "Failed to get group info", "participants": []}

        # Extract participants with phone numbers
        participants = []
        for p in result.get('participants', []):
            jid = p.get('jid', '')
            phone = p.get('phone', '')
            name = p.get('name', '')

            # Only include participants with resolved phone numbers
            if phone:
                participants.append({
                    "jid": jid,
                    "phone": phone,
                    "name": name or phone,  # Use phone as fallback name
                    "is_admin": p.get('is_admin', False),
                    "is_super_admin": p.get('is_super_admin', False)
                })

        return {
            "success": True,
            "group_id": group_id,
            "name": result.get('name', ''),
            "participants": participants,
            "participant_count": len(participants),
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"WhatsApp group_info fetch failed for {group_id}: {e}")
        return {"success": False, "error": str(e), "participants": []}


async def handle_whatsapp_chat_history(params: dict) -> dict:
    """Get chat history from WhatsApp via direct RPC.

    Retrieves stored messages from the Go service's history store.
    Messages are automatically stored from HistorySync (on first login)
    and from real-time incoming messages.

    Params:
    - chat_id: Direct chat JID (e.g., '919876543210@s.whatsapp.net')
    - phone: Phone number (alternative to chat_id, will be converted)
    - group_id: Group JID (alternative for group chats)
    - limit: Max messages to return (default 50, max 500)
    - offset: Pagination offset (default 0)
    - sender_phone: Filter by sender phone in group chats
    - text_only: Only return text messages (default false)

    Returns:
    - messages: Array of MessageRecord
    - total: Total matching messages count
    - has_more: Whether more messages exist
    """
    try:
        client = await get_client()

        # Build RPC params
        rpc_params = {}

        # Determine chat_id from various inputs
        chat_id = params.get("chat_id")
        phone = params.get("phone")
        group_id = params.get("group_id")

        if chat_id:
            rpc_params["chat_id"] = chat_id
        elif phone:
            rpc_params["phone"] = phone
        elif group_id:
            rpc_params["group_id"] = group_id
        else:
            return {"success": False, "error": "Either chat_id, phone, or group_id is required"}

        # Optional filters
        limit = params.get("limit", 50)
        if limit > 500:
            limit = 500
        rpc_params["limit"] = limit

        offset = params.get("offset", 0)
        rpc_params["offset"] = offset

        sender_phone = params.get("sender_phone")
        if sender_phone:
            rpc_params["sender_phone"] = sender_phone

        text_only = params.get("text_only", False)
        rpc_params["text_only"] = text_only

        result = await client.call("chat_history", rpc_params)

        return {
            "success": True,
            "messages": result.get("messages", []),
            "total": result.get("total", 0),
            "has_more": result.get("has_more", False),
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"WhatsApp chat_history fetch failed: {e}")
        return {"success": False, "error": str(e), "messages": [], "total": 0, "has_more": False}
