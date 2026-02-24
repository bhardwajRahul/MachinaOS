"""Google Tasks node handlers using Google API Python client.

API Reference: https://developers.google.com/workspace/tasks/reference/rest
"""

import asyncio
import time
from typing import Any, Dict

from googleapiclient.discovery import build

from core.logging import get_logger
from services.handlers.google_auth import get_google_credentials
from services.pricing import get_pricing_service

logger = get_logger(__name__)


async def _track_tasks_usage(
    node_id: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track Google Tasks API usage for analytics.

    Note: Tasks API is free but rate limited.
    We track for analytics purposes with $0 cost.
    """
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('google_tasks', action, resource_count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'google_tasks',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    logger.debug(f"[Tasks] Tracked usage: {action} x{resource_count}")
    return cost_data


async def _get_tasks_service(
    parameters: Dict[str, Any],
    context: Dict[str, Any]
):
    """Get authenticated Google Tasks service."""
    creds = await get_google_credentials(parameters, context)

    def build_service():
        return build("tasks", "v1", credentials=creds)

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, build_service)


async def handle_tasks_create(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Create a new task.

    Parameters:
        title: Task title (required)
        notes: Task notes/description (optional)
        due_date: Due date in RFC 3339 format (optional)
        tasklist_id: Task list ID (default: @default)
    """
    start_time = time.time()

    try:
        service = await _get_tasks_service(parameters, context)

        title = parameters.get('title', '')
        notes = parameters.get('notes', '')
        due_date = parameters.get('due_date', '')
        tasklist_id = parameters.get('tasklist_id', '@default')

        if not title:
            raise ValueError("Task title is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        task_body = {
            'title': title,
        }

        if notes:
            task_body['notes'] = notes

        if due_date:
            # Ensure RFC 3339 format (add time if only date provided)
            if 'T' not in due_date:
                due_date = f"{due_date}T00:00:00.000Z"
            task_body['due'] = due_date

        def create_task():
            return service.tasks().insert(
                tasklist=tasklist_id,
                body=task_body
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, create_task)

        await _track_tasks_usage(node_id, 'create', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "task_id": result.get('id'),
                "title": result.get('title'),
                "notes": result.get('notes'),
                "due": result.get('due'),
                "status": result.get('status'),
                "self_link": result.get('selfLink'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Tasks create error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_tasks_list(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """List tasks from a task list.

    Parameters:
        tasklist_id: Task list ID (default: @default)
        show_completed: Include completed tasks (default: false)
        show_hidden: Include hidden tasks (default: false)
        max_results: Maximum number of tasks (default: 100)
    """
    start_time = time.time()

    try:
        service = await _get_tasks_service(parameters, context)

        tasklist_id = parameters.get('tasklist_id', '@default')
        show_completed = parameters.get('show_completed', False)
        show_hidden = parameters.get('show_hidden', False)
        max_results = parameters.get('max_results', 100)

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def list_tasks():
            return service.tasks().list(
                tasklist=tasklist_id,
                showCompleted=show_completed,
                showHidden=show_hidden,
                maxResults=max_results
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, list_tasks)

        tasks = result.get('items', [])

        await _track_tasks_usage(node_id, 'list', len(tasks), workflow_id, session_id)

        # Format tasks for output
        formatted_tasks = []
        for task in tasks:
            formatted_tasks.append({
                'task_id': task.get('id'),
                'title': task.get('title'),
                'notes': task.get('notes'),
                'due': task.get('due'),
                'status': task.get('status'),
                'completed': task.get('completed'),
                'position': task.get('position'),
            })

        return {
            "success": True,
            "result": {
                "tasks": formatted_tasks,
                "count": len(formatted_tasks),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Tasks list error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_tasks_complete(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Mark a task as completed.

    Parameters:
        task_id: Task ID (required)
        tasklist_id: Task list ID (default: @default)
    """
    start_time = time.time()

    try:
        service = await _get_tasks_service(parameters, context)

        task_id = parameters.get('task_id', '')
        tasklist_id = parameters.get('tasklist_id', '@default')

        if not task_id:
            raise ValueError("Task ID is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # First get the task to preserve its data
        def get_task():
            return service.tasks().get(
                tasklist=tasklist_id,
                task=task_id
            ).execute()

        loop = asyncio.get_event_loop()
        task = await loop.run_in_executor(None, get_task)

        # Mark as completed
        task['status'] = 'completed'

        def update_task():
            return service.tasks().update(
                tasklist=tasklist_id,
                task=task_id,
                body=task
            ).execute()

        result = await loop.run_in_executor(None, update_task)

        await _track_tasks_usage(node_id, 'complete', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "task_id": result.get('id'),
                "title": result.get('title'),
                "status": result.get('status'),
                "completed": result.get('completed'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Tasks complete error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_tasks_update(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Update an existing task.

    Parameters:
        task_id: Task ID (required)
        tasklist_id: Task list ID (default: @default)
        title: New title (optional)
        notes: New notes (optional)
        due_date: New due date (optional)
        status: New status - 'needsAction' or 'completed' (optional)
    """
    start_time = time.time()

    try:
        service = await _get_tasks_service(parameters, context)

        task_id = parameters.get('task_id', '')
        tasklist_id = parameters.get('tasklist_id', '@default')

        if not task_id:
            raise ValueError("Task ID is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # Get current task
        def get_task():
            return service.tasks().get(
                tasklist=tasklist_id,
                task=task_id
            ).execute()

        loop = asyncio.get_event_loop()
        task = await loop.run_in_executor(None, get_task)

        # Update fields if provided
        if parameters.get('title'):
            task['title'] = parameters['title']
        if parameters.get('notes'):
            task['notes'] = parameters['notes']
        if parameters.get('due_date'):
            due_date = parameters['due_date']
            if 'T' not in due_date:
                due_date = f"{due_date}T00:00:00.000Z"
            task['due'] = due_date
        if parameters.get('status'):
            task['status'] = parameters['status']

        def update_task():
            return service.tasks().update(
                tasklist=tasklist_id,
                task=task_id,
                body=task
            ).execute()

        result = await loop.run_in_executor(None, update_task)

        await _track_tasks_usage(node_id, 'update', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "task_id": result.get('id'),
                "title": result.get('title'),
                "notes": result.get('notes'),
                "due": result.get('due'),
                "status": result.get('status'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Tasks update error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_tasks_delete(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Delete a task.

    Parameters:
        task_id: Task ID (required)
        tasklist_id: Task list ID (default: @default)
    """
    start_time = time.time()

    try:
        service = await _get_tasks_service(parameters, context)

        task_id = parameters.get('task_id', '')
        tasklist_id = parameters.get('tasklist_id', '@default')

        if not task_id:
            raise ValueError("Task ID is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        def delete_task():
            return service.tasks().delete(
                tasklist=tasklist_id,
                task=task_id
            ).execute()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, delete_task)

        await _track_tasks_usage(node_id, 'delete', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "deleted": True,
                "task_id": task_id,
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Tasks delete error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


# ============================================================================
# CONSOLIDATED DISPATCHER
# ============================================================================

async def handle_google_tasks(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Consolidated Tasks handler with operation dispatcher.

    Routes to appropriate handler based on 'operation' parameter:
    - create: Create new task
    - list: List tasks
    - complete: Mark task as complete
    - update: Update existing task
    - delete: Delete task
    """
    operation = parameters.get('operation', 'create')

    # Map update_* parameters to standard names for update operation
    if operation == 'update':
        if parameters.get('update_title'):
            parameters['title'] = parameters['update_title']
        if parameters.get('update_notes'):
            parameters['notes'] = parameters['update_notes']
        if parameters.get('update_due_date'):
            parameters['due_date'] = parameters['update_due_date']
        if parameters.get('update_status'):
            parameters['status'] = parameters['update_status']

    if operation == 'create':
        return await handle_tasks_create(node_id, node_type, parameters, context)
    elif operation == 'list':
        return await handle_tasks_list(node_id, node_type, parameters, context)
    elif operation == 'complete':
        return await handle_tasks_complete(node_id, node_type, parameters, context)
    elif operation == 'update':
        return await handle_tasks_update(node_id, node_type, parameters, context)
    elif operation == 'delete':
        return await handle_tasks_delete(node_id, node_type, parameters, context)
    else:
        return {
            "success": False,
            "error": f"Unknown Tasks operation: {operation}. Supported: create, list, complete, update, delete",
            "execution_time": 0
        }
