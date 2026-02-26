"""
Telegram Node Handlers

Handles execution of Telegram workflow nodes:
- telegramSend: Send messages via Telegram bot
- telegramReceive: Trigger node that waits for incoming messages
"""

import time
from datetime import datetime
from typing import Any, Dict

from core.logging import get_logger

logger = get_logger(__name__)


async def handle_telegram_send(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Telegram send message node execution.

    Parameters (snake_case):
        - chat_id: Chat ID or @username (required)
        - message_type: text, photo, document, location, contact (default: text)
        - text: Message text (for text type)
        - caption: Caption for media (for photo/document types)
        - media_url: URL for photo/document
        - parse_mode: HTML, Markdown, MarkdownV2 (optional)
        - latitude, longitude: For location type
        - phone_number, first_name, last_name: For contact type
        - silent: Send without notification (default: False)
        - reply_to_message_id: Reply to this message (optional)

    Returns:
        Execution result with sent message info
    """
    from services.telegram_service import get_telegram_service

    start_time = time.time()
    service = get_telegram_service()

    try:
        if not service.connected:
            return {
                "success": False,
                "node_id": node_id,
                "node_type": node_type,
                "error": "Telegram bot not connected. Add bot token in Credentials.",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        # Resolve recipient based on type (mirrors WhatsApp self-mode pattern)
        recipient_type = parameters.get("recipient_type", "self")

        if recipient_type == "self":
            chat_id = service.owner_chat_id
            if not chat_id:
                return {
                    "success": False,
                    "node_id": node_id,
                    "node_type": node_type,
                    "error": "Bot owner not detected. Send any message to your bot first.",
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat()
                }
        else:
            chat_id = parameters.get("chat_id")
            if not chat_id:
                return {
                    "success": False,
                    "node_id": node_id,
                    "node_type": node_type,
                    "error": "chat_id is required",
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat()
                }

        message_type = parameters.get("message_type", "text")
        parse_mode = parameters.get("parse_mode") or None
        silent = parameters.get("silent", False)
        reply_to = parameters.get("reply_to_message_id")
        if reply_to:
            reply_to = int(reply_to)

        # Route based on message type
        result = {}
        match message_type:
            case "text":
                text = parameters.get("text")
                if not text:
                    return {
                        "success": False,
                        "node_id": node_id,
                        "node_type": node_type,
                        "error": "text is required for text message",
                        "execution_time": time.time() - start_time,
                        "timestamp": datetime.now().isoformat()
                    }
                result = await service.send_message(
                    chat_id=chat_id,
                    text=text,
                    parse_mode=parse_mode,
                    disable_notification=silent,
                    reply_to_message_id=reply_to,
                )

            case "photo":
                photo_url = parameters.get("media_url")
                if not photo_url:
                    return {
                        "success": False,
                        "node_id": node_id,
                        "node_type": node_type,
                        "error": "media_url is required for photo message",
                        "execution_time": time.time() - start_time,
                        "timestamp": datetime.now().isoformat()
                    }
                result = await service.send_photo(
                    chat_id=chat_id,
                    photo=photo_url,
                    caption=parameters.get("caption"),
                    parse_mode=parse_mode,
                    disable_notification=silent,
                    reply_to_message_id=reply_to,
                )

            case "document":
                document_url = parameters.get("media_url")
                if not document_url:
                    return {
                        "success": False,
                        "node_id": node_id,
                        "node_type": node_type,
                        "error": "media_url is required for document message",
                        "execution_time": time.time() - start_time,
                        "timestamp": datetime.now().isoformat()
                    }
                result = await service.send_document(
                    chat_id=chat_id,
                    document=document_url,
                    caption=parameters.get("caption"),
                    parse_mode=parse_mode,
                    disable_notification=silent,
                    reply_to_message_id=reply_to,
                )

            case "location":
                latitude = parameters.get("latitude")
                longitude = parameters.get("longitude")
                if latitude is None or longitude is None:
                    return {
                        "success": False,
                        "node_id": node_id,
                        "node_type": node_type,
                        "error": "latitude and longitude are required for location message",
                        "execution_time": time.time() - start_time,
                        "timestamp": datetime.now().isoformat()
                    }
                result = await service.send_location(
                    chat_id=chat_id,
                    latitude=float(latitude),
                    longitude=float(longitude),
                    disable_notification=silent,
                    reply_to_message_id=reply_to,
                )

            case "contact":
                phone_number = parameters.get("phone_number")
                first_name = parameters.get("first_name")
                if not phone_number or not first_name:
                    return {
                        "success": False,
                        "node_id": node_id,
                        "node_type": node_type,
                        "error": "phone_number and first_name are required for contact message",
                        "execution_time": time.time() - start_time,
                        "timestamp": datetime.now().isoformat()
                    }
                result = await service.send_contact(
                    chat_id=chat_id,
                    phone_number=phone_number,
                    first_name=first_name,
                    last_name=parameters.get("last_name"),
                    disable_notification=silent,
                    reply_to_message_id=reply_to,
                )

            case _:
                return {
                    "success": False,
                    "node_id": node_id,
                    "node_type": node_type,
                    "error": f"Unsupported message type: {message_type}",
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat()
                }

        logger.info(f"[Telegram] Message sent: type={message_type}, chat={chat_id}, msg_id={result.get('message_id')}")

        return {
            "success": True,
            "node_id": node_id,
            "node_type": node_type,
            "result": {
                "message_id": result.get("message_id"),
                "chat_id": result.get("chat_id"),
                "message_type": message_type,
                "date": result.get("date"),
            },
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"[Telegram] Send failed: {e}")
        return {
            "success": False,
            "node_id": node_id,
            "node_type": node_type,
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def handle_telegram_receive(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Telegram receive trigger node.

    This is an event-driven trigger that waits for incoming Telegram messages.
    Uses the event_waiter system to register a waiter and wait for matching events.

    Filter Parameters:
        - chatTypeFilter: all, private, group, supergroup, channel
        - contentTypeFilter: all, text, photo, video, document, location, contact
        - chat_id: Filter to specific chat (optional)
        - from_user: Filter to specific user ID (optional)
        - keywords: Comma-separated keywords to match in text (optional)
        - ignoreBots: Ignore messages from bots (default: True)

    Returns:
        The matched Telegram message data
    """
    from services import event_waiter
    from services.status_broadcaster import get_status_broadcaster
    from services.telegram_service import get_telegram_service

    start_time = time.time()
    broadcaster = get_status_broadcaster()
    service = get_telegram_service()

    try:
        # Check if bot is connected
        if not service.connected:
            return {
                "success": False,
                "node_id": node_id,
                "node_type": node_type,
                "error": "Telegram bot not connected. Add bot token in Credentials.",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

        # Register waiter with filter
        waiter = event_waiter.register(node_type, node_id, parameters)

        logger.info(f"[Telegram] Trigger {node_id} waiting for message (waiter_id={waiter.id})")

        # Broadcast waiting status
        await broadcaster.update_node_status(
            node_id,
            "waiting",
            {
                "message": "Waiting for Telegram message...",
                "waiter_id": waiter.id,
                "filters": {
                    "chat_type": parameters.get("chatTypeFilter", "all"),
                    "content_type": parameters.get("contentTypeFilter", "all"),
                    "keywords": parameters.get("keywords", ""),
                }
            }
        )

        # Wait for matching event (no timeout - user cancels via cancel_event_wait)
        event_data = await waiter.future

        logger.info(f"[Telegram] Trigger {node_id} received message: {event_data.get('content_type')} from {event_data.get('from_username', event_data.get('from_id'))}")

        return {
            "success": True,
            "node_id": node_id,
            "node_type": node_type,
            "result": event_data,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"[Telegram] Receive failed: {e}")
        return {
            "success": False,
            "node_id": node_id,
            "node_type": node_type,
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
