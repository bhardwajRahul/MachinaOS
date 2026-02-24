"""Gmail node handlers using Google API Python client."""

import asyncio
import base64
import time
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Set

from googleapiclient.discovery import build

from core.logging import get_logger
from services.handlers.google_auth import get_google_credentials
from services.pricing import get_pricing_service

logger = get_logger(__name__)


async def _track_gmail_usage(
    node_id: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track Gmail API usage for analytics.

    Note: Gmail API is free but rate limited (250 quota units/user/second).
    We track for analytics purposes with $0 cost.

    Args:
        node_id: The node executing the Gmail action
        action: Action name matching operation_map keys (send, search, read, etc.)
        resource_count: Number of resources processed
        workflow_id: Optional workflow context
        session_id: Session for aggregation

    Returns:
        Cost breakdown dict (always 0 for Gmail)
    """
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('gmail', action, resource_count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'gmail',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    logger.debug(f"[Gmail] Tracked usage: {action} x{resource_count}")
    return cost_data


async def _get_gmail_service(
    parameters: Dict[str, Any],
    context: Dict[str, Any]
):
    """Get authenticated Gmail service."""
    creds = await get_google_credentials(parameters, context)

    def build_service():
        return build("gmail", "v1", credentials=creds)

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, build_service)


async def handle_gmail_send(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Gmail send operations.

    Parameters:
        to: Recipient email address(es), comma-separated
        cc: CC recipients (optional)
        bcc: BCC recipients (optional)
        subject: Email subject
        body: Email body content
        body_type: 'text' or 'html' (default: 'text')
    """
    start_time = time.time()

    try:
        service = await _get_gmail_service(parameters, context)

        to = parameters.get('to', '')
        cc = parameters.get('cc', '')
        bcc = parameters.get('bcc', '')
        subject = parameters.get('subject', '')
        body = parameters.get('body', '')
        body_type = parameters.get('body_type', 'text')

        if not to:
            raise ValueError("Recipient email address (to) is required")
        if not subject:
            raise ValueError("Email subject is required")
        if not body:
            raise ValueError("Email body is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        if body_type == 'html':
            message = MIMEMultipart('alternative')
            message.attach(MIMEText(body, 'html'))
        else:
            message = MIMEText(body, 'plain')

        message['to'] = to
        message['subject'] = subject
        if cc:
            message['cc'] = cc
        if bcc:
            message['bcc'] = bcc

        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')

        def send_message():
            return service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, send_message)

        await _track_gmail_usage(node_id, 'send', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "message_id": result.get('id'),
                "thread_id": result.get('threadId'),
                "label_ids": result.get('labelIds', []),
                "to": to,
                "subject": subject,
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Gmail send error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_gmail_search(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Gmail search operations.

    Parameters:
        query: Gmail search query (same syntax as Gmail web)
        max_results: Maximum number of messages to return (default: 10, max: 100)
        include_body: Whether to fetch full message body (default: False)
    """
    start_time = time.time()

    try:
        service = await _get_gmail_service(parameters, context)

        query = parameters.get('query', '')
        max_results = min(parameters.get('max_results', 10), 100)
        include_body = parameters.get('include_body', False)

        if not query:
            raise ValueError("Search query is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def search_messages():
            return service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, search_messages)

        messages = result.get('messages', [])
        formatted_messages = []

        for msg in messages:
            msg_id = msg.get('id')

            def get_message(message_id):
                format_type = 'full' if include_body else 'metadata'
                return service.users().messages().get(
                    userId='me',
                    id=message_id,
                    format=format_type,
                    metadataHeaders=['From', 'To', 'Subject', 'Date']
                ).execute()

            msg_detail = await loop.run_in_executor(None, lambda mid=msg_id: get_message(mid))
            formatted_messages.append(_format_message(msg_detail, include_body))

        await _track_gmail_usage(node_id, 'search', len(formatted_messages), workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "messages": formatted_messages,
                "count": len(formatted_messages),
                "query": query,
                "result_size_estimate": result.get('resultSizeEstimate', 0),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Gmail search error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_gmail_read(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Gmail read operations - read a specific message by ID.

    Parameters:
        message_id: The Gmail message ID to read
        format: 'full', 'minimal', 'raw', or 'metadata' (default: 'full')
    """
    start_time = time.time()

    try:
        service = await _get_gmail_service(parameters, context)

        message_id = parameters.get('message_id', '')
        format_type = parameters.get('format', 'full')

        if not message_id:
            raise ValueError("message_id is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def get_message():
            return service.users().messages().get(
                userId='me',
                id=message_id,
                format=format_type
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, get_message)

        await _track_gmail_usage(node_id, 'read', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": _format_message(result, include_body=(format_type == 'full')),
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Gmail read error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


def _format_message(message: Dict[str, Any], include_body: bool = False) -> Dict[str, Any]:
    """Format Gmail message to a cleaner structure."""
    headers = {}
    payload = message.get('payload', {})

    for header in payload.get('headers', []):
        name = header.get('name', '').lower()
        value = header.get('value', '')
        if name in ['from', 'to', 'subject', 'date', 'cc', 'bcc']:
            headers[name] = value

    formatted = {
        "message_id": message.get('id'),
        "thread_id": message.get('threadId'),
        "from": headers.get('from', ''),
        "to": headers.get('to', ''),
        "cc": headers.get('cc', ''),
        "subject": headers.get('subject', ''),
        "date": headers.get('date', ''),
        "snippet": message.get('snippet', ''),
        "labels": message.get('labelIds', []),
        "size_estimate": message.get('sizeEstimate', 0),
    }

    if include_body:
        body = _extract_body(payload)
        formatted['body'] = body

    attachments = _extract_attachments(payload)
    if attachments:
        formatted['attachments'] = attachments

    return formatted


def _extract_body(payload: Dict[str, Any]) -> str:
    """Extract email body from payload, handling multipart messages."""
    body = ""

    if 'body' in payload and payload['body'].get('data'):
        body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='ignore')
        return body

    parts = payload.get('parts', [])
    for part in parts:
        mime_type = part.get('mimeType', '')

        if mime_type == 'text/plain':
            if part.get('body', {}).get('data'):
                body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')
                break
        elif mime_type == 'text/html' and not body:
            if part.get('body', {}).get('data'):
                body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')
        elif mime_type.startswith('multipart/'):
            nested_body = _extract_body(part)
            if nested_body:
                body = nested_body
                break

    return body


def _extract_attachments(payload: Dict[str, Any]) -> list:
    """Extract attachment information from payload."""
    attachments = []
    parts = payload.get('parts', [])

    for part in parts:
        filename = part.get('filename', '')
        if filename:
            attachments.append({
                "filename": filename,
                "mime_type": part.get('mimeType', ''),
                "size": part.get('body', {}).get('size', 0),
                "attachment_id": part.get('body', {}).get('attachmentId', ''),
            })

        if part.get('parts'):
            nested = _extract_attachments(part)
            attachments.extend(nested)

    return attachments


# ============================================================================
# GMAIL RECEIVE - Polling-based trigger
# ============================================================================

async def _poll_gmail_ids(service, query: str, max_results: int = 20) -> Set[str]:
    """Poll Gmail API for message IDs matching query.

    Args:
        service: Authenticated Gmail API service
        query: Gmail search query string
        max_results: Maximum messages to fetch

    Returns:
        Set of message IDs
    """
    def list_messages():
        return service.users().messages().list(
            userId='me',
            q=query,
            maxResults=max_results
        ).execute()

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, list_messages)
    messages = result.get('messages', [])
    return {m.get('id') for m in messages if m.get('id')}


async def _fetch_email_details(service, message_id: str) -> Dict[str, Any]:
    """Fetch full email details for a message ID.

    Args:
        service: Authenticated Gmail API service
        message_id: Gmail message ID

    Returns:
        Formatted email data dict
    """
    def get_message():
        return service.users().messages().get(
            userId='me',
            id=message_id,
            format='full',
            metadataHeaders=['From', 'To', 'Subject', 'Date', 'Cc', 'Bcc']
        ).execute()

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, get_message)
    return _format_message(result, include_body=True)


async def _mark_email_as_read(service, message_id: str) -> None:
    """Mark email as read by removing UNREAD label.

    Args:
        service: Authenticated Gmail API service
        message_id: Gmail message ID
    """
    def modify_message():
        return service.users().messages().modify(
            userId='me',
            id=message_id,
            body={'removeLabelIds': ['UNREAD']}
        ).execute()

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, modify_message)


async def handle_gmail_receive(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Gmail Receive trigger - polls Gmail API for new emails.

    Unlike push-based triggers (WhatsApp, Webhook), Gmail requires polling.
    This handler:
    1. Authenticates with Gmail API using stored OAuth tokens
    2. Establishes a baseline of existing email IDs
    3. Polls at the configured interval for new emails
    4. Returns when a new email is found matching the filter
    5. Dispatches event via event_waiter for deployment mode listeners

    Parameters:
        filter_query: Gmail search query (default: 'is:unread')
        label_filter: Label to filter by (default: 'INBOX')
        mark_as_read: Mark processed emails as read (default: False)
        poll_interval: Seconds between polls (default: 60, range: 30-3600)
    """
    from services.status_broadcaster import get_status_broadcaster
    start_time = time.time()

    try:
        service = await _get_gmail_service(parameters, context)

        poll_interval = max(10, min(3600, parameters.get('poll_interval', 60)))
        filter_query = parameters.get('filter_query', 'is:unread')
        label_filter = parameters.get('label_filter', 'INBOX')
        mark_as_read = parameters.get('mark_as_read', False)

        # Build Gmail query with label filter
        query = filter_query
        if label_filter and label_filter != 'all':
            query = f"label:{label_filter} {query}"

        # Broadcast waiting status
        broadcaster = get_status_broadcaster()
        workflow_id = context.get('workflow_id')
        await broadcaster.update_node_status(node_id, "waiting", {
            "message": f"Waiting for Gmail email (polling every {poll_interval}s)...",
            "event_type": "gmail_email_received",
        }, workflow_id=workflow_id)

        # Get current email IDs to establish baseline (avoid triggering on existing emails)
        seen_ids: Set[str] = set()
        try:
            baseline = await _poll_gmail_ids(service, query)
            seen_ids.update(baseline)
            logger.info(f"[GmailReceive] Baseline: {len(seen_ids)} existing emails for query '{query}'")
        except Exception as e:
            logger.warning(f"[GmailReceive] Baseline fetch failed (will treat all as new): {e}")

        # Poll loop - check for new emails at configured interval
        while True:
            await asyncio.sleep(poll_interval)

            try:
                current_ids = await _poll_gmail_ids(service, query)
                new_ids = current_ids - seen_ids

                if new_ids:
                    # Found new email(s) - process the first one
                    newest_id = next(iter(new_ids))
                    seen_ids.update(new_ids)

                    # Fetch full message details
                    email_data = await _fetch_email_details(service, newest_id)

                    # Mark as read if configured
                    if mark_as_read:
                        try:
                            await _mark_email_as_read(service, newest_id)
                        except Exception as e:
                            logger.warning(f"[GmailReceive] Failed to mark as read: {e}")

                    # Track usage
                    session_id = context.get('session_id', 'default')
                    await _track_gmail_usage(node_id, 'receive', 1, workflow_id, session_id)

                    # Also dispatch event for deployment mode listeners
                    from services import event_waiter
                    event_waiter.dispatch('gmail_email_received', email_data)

                    logger.info(f"[GmailReceive] New email found: {email_data.get('subject', 'no subject')}")

                    return {
                        "success": True,
                        "node_id": node_id,
                        "node_type": node_type,
                        "result": email_data,
                        "execution_time": time.time() - start_time,
                        "timestamp": datetime.now().isoformat()
                    }

            except asyncio.CancelledError:
                raise  # Re-raise to outer handler
            except Exception as e:
                logger.error(f"[GmailReceive] Poll error (will retry): {e}")

    except asyncio.CancelledError:
        logger.info(f"[GmailReceive] Cancelled by user: node_id={node_id}")
        return {
            "success": False,
            "node_id": node_id,
            "node_type": node_type,
            "error": "Cancelled by user",
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"[GmailReceive] Error: {e}")
        return {
            "success": False,
            "node_id": node_id,
            "node_type": node_type,
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


# ============================================================================
# CONSOLIDATED DISPATCHER
# ============================================================================

async def handle_google_gmail(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Consolidated Gmail handler with operation dispatcher.

    Routes to appropriate handler based on 'operation' parameter:
    - send: Send email
    - search: Search emails
    - read: Read specific email by ID
    """
    operation = parameters.get('operation', 'send')

    if operation == 'send':
        return await handle_gmail_send(node_id, node_type, parameters, context)
    elif operation == 'search':
        return await handle_gmail_search(node_id, node_type, parameters, context)
    elif operation == 'read':
        return await handle_gmail_read(node_id, node_type, parameters, context)
    else:
        return {
            "success": False,
            "error": f"Unknown Gmail operation: {operation}. Supported: send, search, read",
            "execution_time": 0
        }
