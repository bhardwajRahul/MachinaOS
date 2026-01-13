"""WhatsApp node handlers - Send and Connect."""

import time
from datetime import datetime
from typing import Dict, Any
from core.logging import get_logger

logger = get_logger(__name__)


async def handle_whatsapp_send(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle WhatsApp send message node via Go RPC service.

    Supports all message types: text, image, video, audio, document, sticker, location, contact
    Recipients: phone number or group_id
    Media sources: base64, file path, or URL

    Args:
        node_id: The node ID
        node_type: The node type (whatsappSend)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict
    """
    from routers.whatsapp import handle_whatsapp_send as whatsapp_send_handler
    start_time = time.time()

    try:
        # Determine recipient
        recipient_type = parameters.get('recipientType', 'phone')
        # Support both group_id (node definition) and groupId (legacy)
        group_id = parameters.get('group_id') or parameters.get('groupId')
        recipient = parameters.get('phone') if recipient_type == 'phone' else group_id
        message_type = parameters.get('messageType', 'text')

        if not recipient:
            raise ValueError(f"{'Phone number' if recipient_type == 'phone' else 'Group ID'} is required")

        # For text messages, validate message content
        if message_type == 'text' and not parameters.get('message'):
            raise ValueError("Message content is required for text messages")

        # Call WhatsApp Go RPC service via handler - pass full params
        data = await whatsapp_send_handler(parameters)

        success = data.get('success', False)
        if not success:
            raise Exception(data.get('error', 'Send failed'))

        # Build informative result based on message type
        result = {
            "status": "sent",
            "recipient": recipient,
            "recipientType": recipient_type,
            "messageType": message_type,
            "timestamp": datetime.now().isoformat()
        }

        # Add type-specific details using match statement
        match message_type:
            case 'text':
                msg_content = parameters.get('message', '')
                result["preview"] = msg_content[:100] + "..." if len(msg_content) > 100 else msg_content
            case 'image' | 'video' | 'audio' | 'document' | 'sticker':
                media_source = parameters.get('mediaSource', 'base64')
                result["mediaSource"] = media_source
                if parameters.get('caption'):
                    result["caption"] = parameters.get('caption')
                if parameters.get('filename'):
                    result["filename"] = parameters.get('filename')
                if parameters.get('mimeType'):
                    result["mimeType"] = parameters.get('mimeType')
                # For file uploads, include the uploaded filename
                file_param = parameters.get('filePath')
                if isinstance(file_param, dict) and file_param.get('type') == 'upload':
                    result["uploadedFile"] = file_param.get('filename')
                    result["mimeType"] = file_param.get('mimeType')
            case 'location':
                result["location"] = {
                    "latitude": parameters.get('latitude'),
                    "longitude": parameters.get('longitude'),
                    "name": parameters.get('locationName'),
                    "address": parameters.get('address')
                }
            case 'contact':
                result["contactName"] = parameters.get('contactName')

        return {
            "success": success,
            "node_id": node_id,
            "node_type": "whatsappSend",
            "result": result,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error("WhatsApp send failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "whatsappSend",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def handle_whatsapp_connect(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle WhatsApp connect - check status via Go RPC service.

    Args:
        node_id: The node ID
        node_type: The node type (whatsappConnect)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict with connection status
    """
    from routers.whatsapp import handle_whatsapp_status
    start_time = time.time()

    try:
        # Call WhatsApp Go RPC service via handler
        data = await handle_whatsapp_status()

        result_data = data.get('data', {})
        return {
            "success": data.get('success', False),
            "node_id": node_id,
            "node_type": "whatsappConnect",
            "result": {
                "connected": result_data.get('connected', False),
                "device_id": result_data.get('device_id'),
                "has_session": result_data.get('has_session', False),
                "running": result_data.get('running', False),
                "status": "connected" if result_data.get('connected') else "disconnected",
                "timestamp": datetime.now().isoformat()
            },
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error("WhatsApp connect failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "whatsappConnect",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def handle_whatsapp_chat_history(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle WhatsApp chat history - retrieve messages from history store.

    Messages are automatically captured from:
    - HistorySync event on first login (all past messages)
    - Real-time incoming messages

    Args:
        node_id: The node ID
        node_type: The node type (whatsappChatHistory)
        parameters: Resolved parameters including:
            - chatType: 'individual' or 'group'
            - phone: Phone number for individual chats
            - group_id: Group JID for group chats
            - groupFilter: 'all' or 'contact' for group message filtering
            - senderPhone: Filter by sender in groups
            - messageFilter: 'all' or 'text_only'
            - limit: Max messages to return
            - offset: Pagination offset
        context: Execution context

    Returns:
        Execution result dict with messages array
    """
    from routers.whatsapp import handle_whatsapp_chat_history as whatsapp_chat_history_handler
    start_time = time.time()

    try:
        chat_type = parameters.get('chatType', 'individual')

        # Build RPC params based on chat type
        rpc_params: Dict[str, Any] = {}

        if chat_type == 'individual':
            phone = parameters.get('phone')
            if not phone:
                raise ValueError("Phone number is required for individual chats")
            rpc_params['phone'] = phone
        else:
            group_id = parameters.get('group_id')
            if not group_id:
                raise ValueError("Group ID is required for group chats")
            rpc_params['group_id'] = group_id

            # Optional sender filter for groups
            group_filter = parameters.get('groupFilter', 'all')
            if group_filter == 'contact':
                sender_phone = parameters.get('senderPhone')
                if sender_phone:
                    rpc_params['sender_phone'] = sender_phone

        # Message type filter
        message_filter = parameters.get('messageFilter', 'all')
        rpc_params['text_only'] = message_filter == 'text_only'

        # Pagination
        rpc_params['limit'] = parameters.get('limit', 50)
        rpc_params['offset'] = parameters.get('offset', 0)

        # Call WhatsApp Go RPC service
        data = await whatsapp_chat_history_handler(rpc_params)

        success = data.get('success', False)
        if not success:
            raise Exception(data.get('error', 'Failed to retrieve chat history'))

        messages = data.get('messages', [])
        total = data.get('total', 0)
        has_more = data.get('has_more', False)

        return {
            "success": True,
            "node_id": node_id,
            "node_type": "whatsappChatHistory",
            "result": {
                "messages": messages,
                "total": total,
                "has_more": has_more,
                "count": len(messages),
                "chat_type": chat_type,
                "timestamp": datetime.now().isoformat()
            },
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error("WhatsApp chat history failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "whatsappChatHistory",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
