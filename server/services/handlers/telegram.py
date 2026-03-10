"""
Telegram Node Handlers

- telegramSend: Send messages via Telegram bot
- telegramReceive: Routed via generic handle_trigger_node + event_waiter.build_telegram_filter()
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
            # Fallback: restore from credentials DB
            if not chat_id:
                try:
                    from core.container import container
                    auth = container.auth_service()
                    saved_owner = await auth.get_api_key("telegram_owner_chat_id")
                    if saved_owner:
                        owner_id = int(saved_owner)
                        await service.set_owner(owner_id)
                        chat_id = owner_id
                        logger.info(f"[Telegram] Owner restored from credentials: {owner_id}")
                except Exception as e:
                    logger.warning(f"[Telegram] Failed to restore owner from credentials: {e}")
            if not chat_id:
                return {
                    "success": False,
                    "node_id": node_id,
                    "node_type": node_type,
                    "error": "Bot owner not detected. Send any private message to your bot on Telegram to auto-detect, or set TELEGRAM_OWNER_CHAT_ID in .env",
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


    # telegramReceive: routed via generic handle_trigger_node in node_executor.py
    # Filter logic lives in event_waiter.build_telegram_filter() with lazy _get_owner_chat_id()
