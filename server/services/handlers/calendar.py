"""Google Calendar node handlers using Google API Python client.

API Reference: https://developers.google.com/workspace/calendar/api/v3/reference
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from core.logging import get_logger
from services.pricing import get_pricing_service

logger = get_logger(__name__)


async def _track_calendar_usage(
    node_id: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track Google Calendar API usage for analytics.

    Note: Calendar API is free but rate limited (1M requests/min).
    We track for analytics purposes with $0 cost.
    """
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('google_calendar', action, resource_count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'google_calendar',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    logger.debug(f"[Calendar] Tracked usage: {action} x{resource_count}")
    return cost_data


async def _get_calendar_service(
    parameters: Dict[str, Any],
    context: Dict[str, Any]
):
    """Get authenticated Google Calendar service.

    Supports two modes:
    - Owner mode: Uses tokens from auth_service (Credentials Modal)
    - Customer mode: Uses tokens from google_connections table
    """
    from core.container import container

    account_mode = parameters.get('account_mode', 'owner')

    if account_mode == 'customer':
        customer_id = parameters.get('customer_id')
        if not customer_id:
            raise ValueError("customer_id required for customer mode")

        db = container.database()
        connection = await db.get_google_connection(customer_id)
        if not connection:
            raise ValueError(f"No Google connection for customer: {customer_id}")

        if not connection.is_active:
            raise ValueError(f"Google connection inactive for customer: {customer_id}")

        access_token = connection.access_token
        refresh_token = connection.refresh_token

        await db.update_google_last_used(customer_id)

    else:
        auth_service = container.auth_service()
        access_token = await auth_service.get_api_key("google_access_token")
        refresh_token = await auth_service.get_api_key("google_refresh_token")

        if not access_token:
            raise ValueError("Google not connected. Please authenticate via Credentials.")

    auth_service = container.auth_service()
    client_id = await auth_service.get_api_key("google_client_id") or ""
    client_secret = await auth_service.get_api_key("google_client_secret") or ""

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
    )

    def build_service():
        return build("calendar", "v3", credentials=creds)

    loop = asyncio.get_event_loop()
    service = await loop.run_in_executor(None, build_service)

    return service


async def handle_calendar_create(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Create a calendar event.

    Parameters:
        title: Event title/summary (required)
        start_time: Start time in ISO format or datetime string (required)
        end_time: End time in ISO format or datetime string (required)
        description: Event description (optional)
        location: Event location (optional)
        attendees: Comma-separated email addresses (optional)
        reminder_minutes: Minutes before event for reminder (optional, default: 30)
        calendar_id: Calendar ID (optional, default: 'primary')
        timezone: Timezone for the event (optional, default: UTC)
    """
    start_time = time.time()

    try:
        service = await _get_calendar_service(parameters, context)

        title = parameters.get('title', '')
        event_start = parameters.get('start_time', '')
        event_end = parameters.get('end_time', '')
        description = parameters.get('description', '')
        location = parameters.get('location', '')
        attendees_str = parameters.get('attendees', '')
        reminder_minutes = parameters.get('reminder_minutes', 30)
        calendar_id = parameters.get('calendar_id', 'primary')
        timezone = parameters.get('timezone', 'UTC')

        if not title:
            raise ValueError("Event title is required")
        if not event_start:
            raise ValueError("Start time is required")
        if not event_end:
            raise ValueError("End time is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # Build event body
        event = {
            'summary': title,
            'start': {'dateTime': event_start, 'timeZone': timezone},
            'end': {'dateTime': event_end, 'timeZone': timezone},
        }

        if description:
            event['description'] = description
        if location:
            event['location'] = location

        # Parse attendees
        if attendees_str:
            attendees = [{'email': e.strip()} for e in attendees_str.split(',') if e.strip()]
            if attendees:
                event['attendees'] = attendees

        # Add reminder
        if reminder_minutes:
            event['reminders'] = {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': int(reminder_minutes)},
                ],
            }

        def create_event():
            return service.events().insert(
                calendarId=calendar_id,
                body=event,
                sendUpdates='all'  # Send email notifications to attendees
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, create_event)

        await _track_calendar_usage(node_id, 'create', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "event_id": result.get('id'),
                "title": result.get('summary'),
                "start": result.get('start', {}).get('dateTime'),
                "end": result.get('end', {}).get('dateTime'),
                "html_link": result.get('htmlLink'),
                "status": result.get('status'),
                "created": result.get('created'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Calendar create error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_calendar_list(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """List calendar events within a date range.

    Parameters:
        start_date: Start date for query (ISO format or 'today', required)
        end_date: End date for query (ISO format or 'today+7d', optional)
        max_results: Maximum number of events to return (default: 10, max: 250)
        calendar_id: Calendar ID (optional, default: 'primary')
        single_events: Expand recurring events (default: True)
        order_by: Sort order - 'startTime' or 'updated' (default: 'startTime')
    """
    start_time = time.time()

    try:
        service = await _get_calendar_service(parameters, context)

        start_date = parameters.get('start_date', '')
        end_date = parameters.get('end_date', '')
        max_results = min(parameters.get('max_results', 10), 250)
        calendar_id = parameters.get('calendar_id', 'primary')
        single_events = parameters.get('single_events', True)
        order_by = parameters.get('order_by', 'startTime')

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # Parse date shortcuts
        now = datetime.utcnow()
        if start_date.lower() == 'today' or not start_date:
            time_min = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + 'Z'
        else:
            time_min = start_date if start_date.endswith('Z') else start_date + 'Z'

        if not end_date:
            # Default to 7 days from now
            time_max = (now + timedelta(days=7)).isoformat() + 'Z'
        elif end_date.startswith('today+'):
            days = int(end_date.replace('today+', '').replace('d', ''))
            time_max = (now + timedelta(days=days)).isoformat() + 'Z'
        else:
            time_max = end_date if end_date.endswith('Z') else end_date + 'Z'

        def list_events():
            return service.events().list(
                calendarId=calendar_id,
                timeMin=time_min,
                timeMax=time_max,
                maxResults=max_results,
                singleEvents=single_events,
                orderBy=order_by if single_events else None
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, list_events)

        events = result.get('items', [])
        formatted_events = []
        for event in events:
            formatted_events.append({
                "event_id": event.get('id'),
                "title": event.get('summary', 'No Title'),
                "start": event.get('start', {}).get('dateTime', event.get('start', {}).get('date')),
                "end": event.get('end', {}).get('dateTime', event.get('end', {}).get('date')),
                "description": event.get('description', ''),
                "location": event.get('location', ''),
                "status": event.get('status'),
                "html_link": event.get('htmlLink'),
                "attendees": [a.get('email') for a in event.get('attendees', [])],
            })

        await _track_calendar_usage(node_id, 'list', len(formatted_events), workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "events": formatted_events,
                "count": len(formatted_events),
                "time_range": {"start": time_min, "end": time_max},
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Calendar list error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_calendar_update(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Update an existing calendar event.

    Parameters:
        event_id: Event ID to update (required)
        title: New event title (optional)
        start_time: New start time (optional)
        end_time: New end time (optional)
        description: New description (optional)
        location: New location (optional)
        calendar_id: Calendar ID (optional, default: 'primary')
    """
    start_time = time.time()

    try:
        service = await _get_calendar_service(parameters, context)

        event_id = parameters.get('event_id', '')
        calendar_id = parameters.get('calendar_id', 'primary')

        if not event_id:
            raise ValueError("Event ID is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # First, get the existing event
        def get_event():
            return service.events().get(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()

        loop = asyncio.get_event_loop()
        event = await loop.run_in_executor(None, get_event)

        # Update fields
        if parameters.get('title'):
            event['summary'] = parameters['title']
        if parameters.get('start_time'):
            tz = event.get('start', {}).get('timeZone', 'UTC')
            event['start'] = {'dateTime': parameters['start_time'], 'timeZone': tz}
        if parameters.get('end_time'):
            tz = event.get('end', {}).get('timeZone', 'UTC')
            event['end'] = {'dateTime': parameters['end_time'], 'timeZone': tz}
        if parameters.get('description') is not None:
            event['description'] = parameters['description']
        if parameters.get('location') is not None:
            event['location'] = parameters['location']

        def update_event():
            return service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event,
                sendUpdates='all'
            ).execute()

        result = await loop.run_in_executor(None, update_event)

        await _track_calendar_usage(node_id, 'update', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "event_id": result.get('id'),
                "title": result.get('summary'),
                "start": result.get('start', {}).get('dateTime'),
                "end": result.get('end', {}).get('dateTime'),
                "updated": result.get('updated'),
                "html_link": result.get('htmlLink'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Calendar update error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_calendar_delete(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Delete a calendar event.

    Parameters:
        event_id: Event ID to delete (required)
        calendar_id: Calendar ID (optional, default: 'primary')
        send_updates: Send cancellation emails ('all', 'none') (default: 'all')
    """
    start_time = time.time()

    try:
        service = await _get_calendar_service(parameters, context)

        event_id = parameters.get('event_id', '')
        calendar_id = parameters.get('calendar_id', 'primary')
        send_updates = parameters.get('send_updates', 'all')

        if not event_id:
            raise ValueError("Event ID is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def delete_event():
            return service.events().delete(
                calendarId=calendar_id,
                eventId=event_id,
                sendUpdates=send_updates
            ).execute()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, delete_event)

        await _track_calendar_usage(node_id, 'delete', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "deleted": True,
                "event_id": event_id,
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Calendar delete error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}
