"""Google Contacts (People API) node handlers using Google API Python client.

API Reference: https://developers.google.com/people/api/rest
"""

import asyncio
import time
from typing import Any, Dict, List

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from core.logging import get_logger
from services.pricing import get_pricing_service

logger = get_logger(__name__)


async def _track_contacts_usage(
    node_id: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track Google Contacts (People API) usage for analytics.

    Note: People API is free but rate limited.
    We track for analytics purposes with $0 cost.
    """
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('google_contacts', action, resource_count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'google_contacts',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    logger.debug(f"[Contacts] Tracked usage: {action} x{resource_count}")
    return cost_data


async def _get_people_service(
    parameters: Dict[str, Any],
    context: Dict[str, Any]
):
    """Get authenticated Google People (Contacts) service."""
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
        return build("people", "v1", credentials=creds)

    loop = asyncio.get_event_loop()
    service = await loop.run_in_executor(None, build_service)

    return service


def _format_contact(person: Dict[str, Any]) -> Dict[str, Any]:
    """Format a People API person resource to a simpler contact format."""
    names = person.get('names', [{}])
    emails = person.get('emailAddresses', [])
    phones = person.get('phoneNumbers', [])
    organizations = person.get('organizations', [])
    addresses = person.get('addresses', [])
    photos = person.get('photos', [])

    # Get primary values
    primary_name = names[0] if names else {}
    primary_email = next((e for e in emails if e.get('metadata', {}).get('primary')), emails[0] if emails else {})
    primary_phone = next((p for p in phones if p.get('metadata', {}).get('primary')), phones[0] if phones else {})
    primary_org = organizations[0] if organizations else {}
    primary_photo = next((p for p in photos if p.get('metadata', {}).get('primary')), photos[0] if photos else {})

    return {
        'resource_name': person.get('resourceName'),
        'display_name': primary_name.get('displayName', ''),
        'given_name': primary_name.get('givenName', ''),
        'family_name': primary_name.get('familyName', ''),
        'email': primary_email.get('value', ''),
        'phone': primary_phone.get('value', ''),
        'company': primary_org.get('name', ''),
        'job_title': primary_org.get('title', ''),
        'photo_url': primary_photo.get('url', ''),
        'emails': [e.get('value') for e in emails],
        'phones': [p.get('value') for p in phones],
    }


async def handle_contacts_create(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Create a new contact.

    Parameters:
        first_name: First name (required)
        last_name: Last name (optional)
        email: Email address (optional)
        phone: Phone number (optional)
        company: Company/organization name (optional)
        job_title: Job title (optional)
        notes: Additional notes (optional)
    """
    start_time = time.time()

    try:
        service = await _get_people_service(parameters, context)

        first_name = parameters.get('first_name', '')
        last_name = parameters.get('last_name', '')
        email = parameters.get('email', '')
        phone = parameters.get('phone', '')
        company = parameters.get('company', '')
        job_title = parameters.get('job_title', '')
        notes = parameters.get('notes', '')

        if not first_name:
            raise ValueError("First name is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # Build contact body
        contact_body = {
            'names': [{
                'givenName': first_name,
                'familyName': last_name,
            }]
        }

        if email:
            contact_body['emailAddresses'] = [{'value': email}]

        if phone:
            contact_body['phoneNumbers'] = [{'value': phone}]

        if company or job_title:
            contact_body['organizations'] = [{
                'name': company,
                'title': job_title,
            }]

        if notes:
            contact_body['biographies'] = [{
                'value': notes,
                'contentType': 'TEXT_PLAIN',
            }]

        def create_contact():
            return service.people().createContact(body=contact_body).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, create_contact)

        await _track_contacts_usage(node_id, 'create', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": _format_contact(result),
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Contacts create error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_contacts_list(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """List contacts.

    Parameters:
        page_size: Number of contacts to return (default: 100)
        page_token: Token for pagination (optional)
        sort_order: Sort order - 'LAST_MODIFIED_ASCENDING' or 'LAST_MODIFIED_DESCENDING' or 'FIRST_NAME_ASCENDING' or 'LAST_NAME_ASCENDING'
    """
    start_time = time.time()

    try:
        service = await _get_people_service(parameters, context)

        page_size = parameters.get('page_size', 100)
        page_token = parameters.get('page_token', '')
        sort_order = parameters.get('sort_order', 'LAST_MODIFIED_DESCENDING')

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def list_contacts():
            request_params = {
                'resourceName': 'people/me',
                'pageSize': page_size,
                'personFields': 'names,emailAddresses,phoneNumbers,organizations,photos,biographies',
                'sortOrder': sort_order,
            }
            if page_token:
                request_params['pageToken'] = page_token
            return service.people().connections().list(**request_params).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, list_contacts)

        connections = result.get('connections', [])

        await _track_contacts_usage(node_id, 'list', len(connections), workflow_id, session_id)

        # Format contacts
        contacts = [_format_contact(person) for person in connections]

        return {
            "success": True,
            "result": {
                "contacts": contacts,
                "count": len(contacts),
                "total_people": result.get('totalPeople', 0),
                "next_page_token": result.get('nextPageToken'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Contacts list error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_contacts_search(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Search contacts by query.

    Parameters:
        query: Search query (name, email, phone, etc.)
        page_size: Number of results to return (default: 30)
    """
    start_time = time.time()

    try:
        service = await _get_people_service(parameters, context)

        query = parameters.get('query', '')
        page_size = parameters.get('page_size', 30)

        if not query:
            raise ValueError("Search query is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def search_contacts():
            return service.people().searchContacts(
                query=query,
                pageSize=page_size,
                readMask='names,emailAddresses,phoneNumbers,organizations,photos'
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, search_contacts)

        results = result.get('results', [])

        await _track_contacts_usage(node_id, 'search', len(results), workflow_id, session_id)

        # Format contacts from search results
        contacts = []
        for r in results:
            person = r.get('person', {})
            contacts.append(_format_contact(person))

        return {
            "success": True,
            "result": {
                "contacts": contacts,
                "count": len(contacts),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Contacts search error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_contacts_get(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Get a specific contact by resource name.

    Parameters:
        resource_name: Contact resource name (e.g., 'people/c12345678')
    """
    start_time = time.time()

    try:
        service = await _get_people_service(parameters, context)

        resource_name = parameters.get('resource_name', '')

        if not resource_name:
            raise ValueError("Resource name is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def get_contact():
            return service.people().get(
                resourceName=resource_name,
                personFields='names,emailAddresses,phoneNumbers,organizations,photos,biographies,addresses'
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, get_contact)

        await _track_contacts_usage(node_id, 'get', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": _format_contact(result),
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Contacts get error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_contacts_update(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Update an existing contact.

    Parameters:
        resource_name: Contact resource name (required)
        first_name: New first name (optional)
        last_name: New last name (optional)
        email: New email (optional)
        phone: New phone (optional)
        company: New company (optional)
        job_title: New job title (optional)
    """
    start_time = time.time()

    try:
        service = await _get_people_service(parameters, context)

        resource_name = parameters.get('resource_name', '')

        if not resource_name:
            raise ValueError("Resource name is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # First get the current contact to get etag
        def get_contact():
            return service.people().get(
                resourceName=resource_name,
                personFields='names,emailAddresses,phoneNumbers,organizations,metadata'
            ).execute()

        loop = asyncio.get_event_loop()
        current = await loop.run_in_executor(None, get_contact)

        # Build update body
        update_body = {'etag': current.get('etag')}
        update_person_fields = []

        if parameters.get('first_name') or parameters.get('last_name'):
            update_body['names'] = [{
                'givenName': parameters.get('first_name', current.get('names', [{}])[0].get('givenName', '')),
                'familyName': parameters.get('last_name', current.get('names', [{}])[0].get('familyName', '')),
            }]
            update_person_fields.append('names')

        if parameters.get('email'):
            update_body['emailAddresses'] = [{'value': parameters['email']}]
            update_person_fields.append('emailAddresses')

        if parameters.get('phone'):
            update_body['phoneNumbers'] = [{'value': parameters['phone']}]
            update_person_fields.append('phoneNumbers')

        if parameters.get('company') or parameters.get('job_title'):
            update_body['organizations'] = [{
                'name': parameters.get('company', ''),
                'title': parameters.get('job_title', ''),
            }]
            update_person_fields.append('organizations')

        if not update_person_fields:
            raise ValueError("At least one field to update is required")

        def update_contact():
            return service.people().updateContact(
                resourceName=resource_name,
                body=update_body,
                updatePersonFields=','.join(update_person_fields)
            ).execute()

        result = await loop.run_in_executor(None, update_contact)

        await _track_contacts_usage(node_id, 'update', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": _format_contact(result),
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Contacts update error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_contacts_delete(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Delete a contact.

    Parameters:
        resource_name: Contact resource name (required)
    """
    start_time = time.time()

    try:
        service = await _get_people_service(parameters, context)

        resource_name = parameters.get('resource_name', '')

        if not resource_name:
            raise ValueError("Resource name is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def delete_contact():
            return service.people().deleteContact(resourceName=resource_name).execute()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, delete_contact)

        await _track_contacts_usage(node_id, 'delete', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "deleted": True,
                "resource_name": resource_name,
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Contacts delete error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


# ============================================================================
# CONSOLIDATED DISPATCHER
# ============================================================================

async def handle_google_contacts(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Consolidated Contacts handler with operation dispatcher.

    Routes to appropriate handler based on 'operation' parameter:
    - create: Create new contact
    - list: List contacts
    - search: Search contacts
    - get: Get contact by resource name
    - update: Update existing contact
    - delete: Delete contact
    """
    operation = parameters.get('operation', 'create')

    # Map update_* parameters to standard names for update operation
    if operation == 'update':
        if parameters.get('update_first_name'):
            parameters['first_name'] = parameters['update_first_name']
        if parameters.get('update_last_name'):
            parameters['last_name'] = parameters['update_last_name']
        if parameters.get('update_email'):
            parameters['email'] = parameters['update_email']
        if parameters.get('update_phone'):
            parameters['phone'] = parameters['update_phone']
        if parameters.get('update_company'):
            parameters['company'] = parameters['update_company']
        if parameters.get('update_job_title'):
            parameters['job_title'] = parameters['update_job_title']

    if operation == 'create':
        return await handle_contacts_create(node_id, node_type, parameters, context)
    elif operation == 'list':
        return await handle_contacts_list(node_id, node_type, parameters, context)
    elif operation == 'search':
        return await handle_contacts_search(node_id, node_type, parameters, context)
    elif operation == 'get':
        return await handle_contacts_get(node_id, node_type, parameters, context)
    elif operation == 'update':
        return await handle_contacts_update(node_id, node_type, parameters, context)
    elif operation == 'delete':
        return await handle_contacts_delete(node_id, node_type, parameters, context)
    else:
        return {
            "success": False,
            "error": f"Unknown Contacts operation: {operation}. Supported: create, list, search, get, update, delete",
            "execution_time": 0
        }
