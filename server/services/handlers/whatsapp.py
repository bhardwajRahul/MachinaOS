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


async def handle_whatsapp_db(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle WhatsApp DB node - query contacts, groups, messages.

    Operations:
    - chat_history: Retrieve messages from history store
    - search_groups: Search groups by name
    - get_group_info: Get group details with participant names
    - get_contact_info: Get full contact info (name, phone, photo)
    - list_contacts: List contacts with saved names
    - check_contacts: Check WhatsApp registration

    Args:
        node_id: The node ID
        node_type: The node type (whatsappDb)
        parameters: Resolved parameters including operation and operation-specific params
        context: Execution context

    Returns:
        Execution result dict
    """
    from routers.whatsapp import (
        handle_whatsapp_chat_history as whatsapp_chat_history_handler,
        whatsapp_rpc_call
    )
    start_time = time.time()

    try:
        operation = parameters.get('operation', 'chat_history')

        if operation == 'chat_history':
            return await _handle_chat_history(node_id, parameters, start_time, whatsapp_chat_history_handler)
        elif operation == 'search_groups':
            return await _handle_search_groups(node_id, parameters, start_time, whatsapp_rpc_call)
        elif operation == 'get_group_info':
            return await _handle_get_group_info(node_id, parameters, start_time, whatsapp_rpc_call)
        elif operation == 'get_contact_info':
            return await _handle_get_contact_info(node_id, parameters, start_time, whatsapp_rpc_call)
        elif operation == 'list_contacts':
            return await _handle_list_contacts(node_id, parameters, start_time, whatsapp_rpc_call)
        elif operation == 'check_contacts':
            return await _handle_check_contacts(node_id, parameters, start_time, whatsapp_rpc_call)
        else:
            raise ValueError(f"Unknown operation: {operation}")

    except Exception as e:
        logger.error("WhatsApp DB failed", node_id=node_id, operation=parameters.get('operation'), error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "whatsappDb",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def _handle_chat_history(node_id: str, parameters: Dict[str, Any], start_time: float, handler) -> Dict[str, Any]:
    """Handle chat_history operation."""
    chat_type = parameters.get('chatType', 'individual')
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

        group_filter = parameters.get('groupFilter', 'all')
        if group_filter == 'contact':
            sender_phone = parameters.get('senderPhone')
            if sender_phone:
                rpc_params['sender_phone'] = sender_phone

    message_filter = parameters.get('messageFilter', 'all')
    rpc_params['text_only'] = message_filter == 'text_only'
    rpc_params['limit'] = parameters.get('limit', 50)
    rpc_params['offset'] = parameters.get('offset', 0)

    data = await handler(rpc_params)

    if not data.get('success', False):
        raise Exception(data.get('error', 'Failed to retrieve chat history'))

    messages = data.get('messages', [])
    base_offset = rpc_params.get('offset', 0)
    for i, msg in enumerate(messages):
        msg['index'] = base_offset + i + 1

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "chat_history",
            "messages": messages,
            "total": data.get('total', 0),
            "has_more": data.get('has_more', False),
            "count": len(messages),
            "chat_type": chat_type,
            "timestamp": datetime.now().isoformat()
        },
        "execution_time": time.time() - start_time,
        "timestamp": datetime.now().isoformat()
    }


async def _handle_search_groups(node_id: str, parameters: Dict[str, Any], start_time: float, rpc_call) -> Dict[str, Any]:
    """Handle search_groups operation."""
    query = parameters.get('query', '')
    data = await rpc_call('groups', {})

    if not data.get('success', True):
        raise Exception(data.get('error', 'Failed to get groups'))

    groups = data if isinstance(data, list) else data.get('result', [])

    # Filter by query if provided
    if query:
        query_lower = query.lower()
        groups = [g for g in groups if query_lower in g.get('name', '').lower()]

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "search_groups",
            "groups": groups,
            "total": len(groups),
            "query": query,
            "timestamp": datetime.now().isoformat()
        },
        "execution_time": time.time() - start_time,
        "timestamp": datetime.now().isoformat()
    }


async def _handle_get_group_info(node_id: str, parameters: Dict[str, Any], start_time: float, rpc_call) -> Dict[str, Any]:
    """Handle get_group_info operation."""
    group_id = parameters.get('groupIdForInfo') or parameters.get('group_id')
    if not group_id:
        raise ValueError("Group ID is required")

    data = await rpc_call('group_info', {'group_id': group_id})

    if not data.get('success', True) if isinstance(data, dict) else True:
        raise Exception(data.get('error', 'Failed to get group info') if isinstance(data, dict) else 'Failed')

    result = data if not isinstance(data, dict) or 'result' not in data else data.get('result', data)

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "get_group_info",
            **result,
            "timestamp": datetime.now().isoformat()
        },
        "execution_time": time.time() - start_time,
        "timestamp": datetime.now().isoformat()
    }


async def _handle_get_contact_info(node_id: str, parameters: Dict[str, Any], start_time: float, rpc_call) -> Dict[str, Any]:
    """Handle get_contact_info operation."""
    phone = parameters.get('contactPhone') or parameters.get('phone')
    if not phone:
        raise ValueError("Phone number is required")

    data = await rpc_call('contact_info', {'phone': phone})

    if isinstance(data, dict) and not data.get('success', True):
        raise Exception(data.get('error', 'Failed to get contact info'))

    result = data if not isinstance(data, dict) or 'result' not in data else data.get('result', data)

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "get_contact_info",
            **result,
            "timestamp": datetime.now().isoformat()
        },
        "execution_time": time.time() - start_time,
        "timestamp": datetime.now().isoformat()
    }


async def _handle_list_contacts(node_id: str, parameters: Dict[str, Any], start_time: float, rpc_call) -> Dict[str, Any]:
    """Handle list_contacts operation."""
    query = parameters.get('query', '')

    data = await rpc_call('contacts', {'query': query})

    if isinstance(data, dict) and not data.get('success', True):
        raise Exception(data.get('error', 'Failed to list contacts'))

    result = data if not isinstance(data, dict) or 'result' not in data else data.get('result', data)
    contacts = result.get('contacts', []) if isinstance(result, dict) else result

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "list_contacts",
            "contacts": contacts,
            "total": len(contacts),
            "query": query,
            "timestamp": datetime.now().isoformat()
        },
        "execution_time": time.time() - start_time,
        "timestamp": datetime.now().isoformat()
    }


async def _handle_check_contacts(node_id: str, parameters: Dict[str, Any], start_time: float, rpc_call) -> Dict[str, Any]:
    """Handle check_contacts operation."""
    phones_str = parameters.get('phones', '')
    if not phones_str:
        raise ValueError("Phone numbers are required")

    # Parse comma-separated phones
    phones = [p.strip() for p in phones_str.split(',') if p.strip()]
    if not phones:
        raise ValueError("At least one phone number is required")

    data = await rpc_call('contact_check', {'phones': phones})

    if isinstance(data, dict) and not data.get('success', True):
        raise Exception(data.get('error', 'Failed to check contacts'))

    results = data if isinstance(data, list) else data.get('result', [])

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "check_contacts",
            "results": results,
            "total": len(results),
            "timestamp": datetime.now().isoformat()
        },
        "execution_time": time.time() - start_time,
        "timestamp": datetime.now().isoformat()
    }


