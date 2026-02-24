"""Google Sheets node handlers using Google API Python client.

API Reference: https://developers.google.com/workspace/sheets/api/reference/rest
"""

import asyncio
import time
from typing import Any, Dict, List

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from core.logging import get_logger
from services.pricing import get_pricing_service

logger = get_logger(__name__)


async def _track_sheets_usage(
    node_id: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track Google Sheets API usage for analytics.

    Note: Sheets API is free but rate limited (300 requests/min).
    We track for analytics purposes with $0 cost.
    """
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('google_sheets', action, resource_count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'google_sheets',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    logger.debug(f"[Sheets] Tracked usage: {action} x{resource_count}")
    return cost_data


async def _get_sheets_service(
    parameters: Dict[str, Any],
    context: Dict[str, Any]
):
    """Get authenticated Google Sheets service."""
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
        return build("sheets", "v4", credentials=creds)

    loop = asyncio.get_event_loop()
    service = await loop.run_in_executor(None, build_service)

    return service


async def handle_sheets_read(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Read data from a Google Sheets spreadsheet.

    Parameters:
        spreadsheet_id: ID of the spreadsheet (required)
        range: A1 notation range (e.g., "Sheet1!A1:D10") (required)
        value_render_option: How values should be rendered ('FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA')
        major_dimension: Rows or columns first ('ROWS', 'COLUMNS')
    """
    start_time = time.time()

    try:
        service = await _get_sheets_service(parameters, context)

        spreadsheet_id = parameters.get('spreadsheet_id', '')
        range_notation = parameters.get('range', '')
        value_render = parameters.get('value_render_option', 'FORMATTED_VALUE')
        major_dimension = parameters.get('major_dimension', 'ROWS')

        if not spreadsheet_id:
            raise ValueError("Spreadsheet ID is required")
        if not range_notation:
            raise ValueError("Range is required (e.g., 'Sheet1!A1:D10')")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def read_values():
            return service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_notation,
                valueRenderOption=value_render,
                majorDimension=major_dimension
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, read_values)

        values = result.get('values', [])

        await _track_sheets_usage(node_id, 'read', len(values), workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "values": values,
                "range": result.get('range'),
                "rows": len(values),
                "columns": len(values[0]) if values else 0,
                "major_dimension": result.get('majorDimension'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Sheets read error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_sheets_write(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Write data to a Google Sheets spreadsheet.

    Parameters:
        spreadsheet_id: ID of the spreadsheet (required)
        range: A1 notation range (e.g., "Sheet1!A1") (required)
        values: 2D array of values to write (required)
        value_input_option: How input values should be interpreted ('RAW', 'USER_ENTERED')
    """
    start_time = time.time()

    try:
        service = await _get_sheets_service(parameters, context)

        spreadsheet_id = parameters.get('spreadsheet_id', '')
        range_notation = parameters.get('range', '')
        values = parameters.get('values', [])
        value_input = parameters.get('value_input_option', 'USER_ENTERED')

        if not spreadsheet_id:
            raise ValueError("Spreadsheet ID is required")
        if not range_notation:
            raise ValueError("Range is required (e.g., 'Sheet1!A1')")
        if not values:
            raise ValueError("Values are required")

        # Parse values if string (JSON format)
        if isinstance(values, str):
            import json
            values = json.loads(values)

        # Ensure values is a 2D array
        if values and not isinstance(values[0], list):
            values = [values]

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        body = {'values': values}

        def write_values():
            return service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_notation,
                valueInputOption=value_input,
                body=body
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, write_values)

        await _track_sheets_usage(node_id, 'write', result.get('updatedCells', 0), workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "updated_range": result.get('updatedRange'),
                "updated_rows": result.get('updatedRows'),
                "updated_columns": result.get('updatedColumns'),
                "updated_cells": result.get('updatedCells'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Sheets write error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_sheets_append(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Append rows to a Google Sheets spreadsheet.

    Parameters:
        spreadsheet_id: ID of the spreadsheet (required)
        range: A1 notation range (e.g., "Sheet1!A:D") (required)
        values: 2D array of values to append (required)
        value_input_option: How input values should be interpreted ('RAW', 'USER_ENTERED')
        insert_data_option: How the input data should be inserted ('OVERWRITE', 'INSERT_ROWS')
    """
    start_time = time.time()

    try:
        service = await _get_sheets_service(parameters, context)

        spreadsheet_id = parameters.get('spreadsheet_id', '')
        range_notation = parameters.get('range', '')
        values = parameters.get('values', [])
        value_input = parameters.get('value_input_option', 'USER_ENTERED')
        insert_option = parameters.get('insert_data_option', 'INSERT_ROWS')

        if not spreadsheet_id:
            raise ValueError("Spreadsheet ID is required")
        if not range_notation:
            raise ValueError("Range is required (e.g., 'Sheet1!A:D')")
        if not values:
            raise ValueError("Values are required")

        # Parse values if string (JSON format)
        if isinstance(values, str):
            import json
            values = json.loads(values)

        # Ensure values is a 2D array
        if values and not isinstance(values[0], list):
            values = [values]

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        body = {'values': values}

        def append_values():
            return service.spreadsheets().values().append(
                spreadsheetId=spreadsheet_id,
                range=range_notation,
                valueInputOption=value_input,
                insertDataOption=insert_option,
                body=body
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, append_values)

        updates = result.get('updates', {})

        await _track_sheets_usage(node_id, 'append', updates.get('updatedCells', 0), workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "updated_range": updates.get('updatedRange'),
                "updated_rows": updates.get('updatedRows'),
                "updated_columns": updates.get('updatedColumns'),
                "updated_cells": updates.get('updatedCells'),
                "table_range": result.get('tableRange'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Sheets append error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


# ============================================================================
# CONSOLIDATED DISPATCHER
# ============================================================================

async def handle_google_sheets(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Consolidated Sheets handler with operation dispatcher.

    Routes to appropriate handler based on 'operation' parameter:
    - read: Read data from spreadsheet
    - write: Write data to spreadsheet
    - append: Append rows to spreadsheet
    """
    operation = parameters.get('operation', 'read')

    if operation == 'read':
        return await handle_sheets_read(node_id, node_type, parameters, context)
    elif operation == 'write':
        return await handle_sheets_write(node_id, node_type, parameters, context)
    elif operation == 'append':
        return await handle_sheets_append(node_id, node_type, parameters, context)
    else:
        return {
            "success": False,
            "error": f"Unknown Sheets operation: {operation}. Supported: read, write, append",
            "execution_time": 0
        }
