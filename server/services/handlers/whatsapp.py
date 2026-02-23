"""WhatsApp node handlers - Send and DB operations."""

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
        # Determine recipient (snake_case parameters)
        recipient_type = parameters.get('recipient_type', 'self')
        message_type = parameters.get('message_type', 'text')

        # Determine recipient based on type
        if recipient_type == 'self':
            # Self will be resolved by the router using connected phone
            recipient = 'self'
        elif recipient_type == 'group':
            recipient = parameters.get('group_id')
            if not recipient:
                raise ValueError("Group ID is required")
        else:  # phone
            recipient = parameters.get('phone')
            if not recipient:
                raise ValueError("Phone number is required")

        # For text messages, validate message content
        if message_type == 'text' and not parameters.get('message'):
            raise ValueError("Message content is required for text messages")

        # Call WhatsApp Go RPC service via handler - pass full params
        data = await whatsapp_send_handler(parameters)

        success = data.get('success', False)
        if not success:
            raise Exception(data.get('error', 'Send failed'))

        # Build informative result based on message type (snake_case output)
        result = {
            "status": "sent",
            "recipient": recipient,
            "recipient_type": recipient_type,
            "message_type": message_type,
            "timestamp": datetime.now().isoformat()
        }

        # Add type-specific details using match statement
        match message_type:
            case 'text':
                msg_content = parameters.get('message', '')
                result["preview"] = msg_content[:100] + "..." if len(msg_content) > 100 else msg_content
            case 'image' | 'video' | 'audio' | 'document' | 'sticker':
                media_source = parameters.get('media_source', 'base64')
                result["media_source"] = media_source
                if parameters.get('caption'):
                    result["caption"] = parameters.get('caption')
                if parameters.get('filename'):
                    result["filename"] = parameters.get('filename')
                if parameters.get('mime_type'):
                    result["mime_type"] = parameters.get('mime_type')
                # For file uploads, include the uploaded filename
                file_param = parameters.get('file_path')
                if isinstance(file_param, dict) and file_param.get('type') == 'upload':
                    result["uploaded_file"] = file_param.get('filename')
                    result["mime_type"] = file_param.get('mimeType')
            case 'location':
                result["location"] = {
                    "latitude": parameters.get('latitude'),
                    "longitude": parameters.get('longitude'),
                    "name": parameters.get('location_name'),
                    "address": parameters.get('address')
                }
            case 'contact':
                result["contact_name"] = parameters.get('contact_name')

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
    chat_type = parameters.get('chat_type', 'individual')
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

        group_filter = parameters.get('group_filter', 'all')
        if group_filter == 'contact':
            sender_phone = parameters.get('sender_phone')
            if sender_phone:
                rpc_params['sender_phone'] = sender_phone

    message_filter = parameters.get('message_filter', 'all')
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
    limit = parameters.get('limit', 20)  # Default limit to prevent context overflow
    data = await rpc_call('groups', {})

    if not data.get('success', True):
        raise Exception(data.get('error', 'Failed to get groups'))

    groups = data if isinstance(data, list) else data.get('result', [])

    # Filter by query if provided
    if query:
        query_lower = query.lower()
        groups = [g for g in groups if query_lower in g.get('name', '').lower()]

    total_found = len(groups)

    # Apply limit to prevent context overflow (51 groups * ~4KB = 200KB+ tokens)
    # Only return essential fields: jid and name
    groups_limited = [
        {"jid": g.get("jid", ""), "name": g.get("name", "")}
        for g in groups[:limit]
    ]

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "search_groups",
            "groups": groups_limited,
            "total": total_found,
            "returned": len(groups_limited),
            "has_more": total_found > limit,
            "query": query,
            "hint": f"Showing {len(groups_limited)} of {total_found} groups. Use a more specific query or get_group_info for details." if total_found > limit else None,
            "timestamp": datetime.now().isoformat()
        },
        "execution_time": time.time() - start_time,
        "timestamp": datetime.now().isoformat()
    }


async def _handle_get_group_info(node_id: str, parameters: Dict[str, Any], start_time: float, rpc_call) -> Dict[str, Any]:
    """Handle get_group_info operation."""
    group_id = parameters.get('group_id_for_info') or parameters.get('group_id')
    if not group_id:
        raise ValueError("Group ID is required")

    participant_limit = parameters.get('participant_limit', 50)  # Limit participants to prevent overflow

    data = await rpc_call('group_info', {'group_id': group_id})

    if not data.get('success', True) if isinstance(data, dict) else True:
        raise Exception(data.get('error', 'Failed to get group info') if isinstance(data, dict) else 'Failed')

    result = data if not isinstance(data, dict) or 'result' not in data else data.get('result', data)

    # Limit participants and return only essential fields
    participants = result.get('participants', [])
    total_participants = len(participants)
    participants_limited = [
        {"phone": p.get("phone", ""), "name": p.get("name", ""), "is_admin": p.get("is_admin", False)}
        for p in participants[:participant_limit]
    ]

    # Build limited result
    limited_result = {
        "name": result.get("name", ""),
        "jid": result.get("jid", group_id),
        "participants": participants_limited,
        "total_participants": total_participants,
        "participants_shown": len(participants_limited),
    }

    if total_participants > participant_limit:
        limited_result["hint"] = f"Showing {participant_limit} of {total_participants} participants."

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "get_group_info",
            **limited_result,
            "timestamp": datetime.now().isoformat()
        },
        "execution_time": time.time() - start_time,
        "timestamp": datetime.now().isoformat()
    }


async def _handle_get_contact_info(node_id: str, parameters: Dict[str, Any], start_time: float, rpc_call) -> Dict[str, Any]:
    """Handle get_contact_info operation."""
    phone = parameters.get('contact_phone') or parameters.get('phone')
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
    limit = parameters.get('limit', 50)  # Default limit to prevent context overflow

    data = await rpc_call('contacts', {'query': query})

    if isinstance(data, dict) and not data.get('success', True):
        raise Exception(data.get('error', 'Failed to list contacts'))

    result = data if not isinstance(data, dict) or 'result' not in data else data.get('result', data)
    contacts = result.get('contacts', []) if isinstance(result, dict) else result

    total_found = len(contacts)

    # Apply limit and return only essential fields: phone, name, jid
    contacts_limited = [
        {"phone": c.get("phone", ""), "name": c.get("name", ""), "jid": c.get("jid", "")}
        for c in contacts[:limit]
    ]

    return {
        "success": True,
        "node_id": node_id,
        "node_type": "whatsappDb",
        "result": {
            "operation": "list_contacts",
            "contacts": contacts_limited,
            "total": total_found,
            "returned": len(contacts_limited),
            "has_more": total_found > limit,
            "query": query,
            "hint": f"Showing {len(contacts_limited)} of {total_found} contacts. Use a more specific query to narrow results." if total_found > limit else None,
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


