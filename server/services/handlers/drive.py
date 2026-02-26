"""Google Drive node handlers using Google API Python client.

API Reference: https://developers.google.com/drive/api/v3/reference
"""

import asyncio
import io
import time
from typing import Any, Dict

import httpx
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

from core.logging import get_logger
from services.handlers.google_auth import get_google_credentials
from services.pricing import get_pricing_service

logger = get_logger(__name__)


async def _track_drive_usage(
    node_id: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track Google Drive API usage for analytics.

    Note: Drive API is free but rate limited (20K requests/100s).
    We track for analytics purposes with $0 cost.
    """
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('google_drive', action, resource_count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'google_drive',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    logger.debug(f"[Drive] Tracked usage: {action} x{resource_count}")
    return cost_data


async def _get_drive_service(
    parameters: Dict[str, Any],
    context: Dict[str, Any]
):
    """Get authenticated Google Drive service."""
    creds = await get_google_credentials(parameters, context)

    def build_service():
        return build("drive", "v3", credentials=creds)

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, build_service)


async def handle_drive_upload(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Upload a file to Google Drive.

    Parameters:
        file_url: URL to download file from (for remote files)
        file_content: Base64-encoded file content (for direct upload)
        filename: Name for the uploaded file (required)
        folder_id: Parent folder ID (optional, default: root)
        mime_type: File MIME type (optional, auto-detected)
        description: File description (optional)
    """
    start_time = time.time()

    try:
        service = await _get_drive_service(parameters, context)

        file_url = parameters.get('file_url', '')
        file_content = parameters.get('file_content', '')
        filename = parameters.get('filename', '')
        folder_id = parameters.get('folder_id', '')
        mime_type = parameters.get('mime_type', 'application/octet-stream')
        description = parameters.get('description', '')

        if not filename:
            raise ValueError("Filename is required")
        if not file_url and not file_content:
            raise ValueError("Either file_url or file_content is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # Build file metadata
        file_metadata = {'name': filename}
        if folder_id:
            file_metadata['parents'] = [folder_id]
        if description:
            file_metadata['description'] = description

        # Get file content
        if file_url:
            # Download from URL
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url, timeout=60.0)
                response.raise_for_status()
                file_bytes = response.content
                # Try to detect mime type from response
                if 'content-type' in response.headers and mime_type == 'application/octet-stream':
                    mime_type = response.headers['content-type'].split(';')[0]
        else:
            # Decode base64 content
            import base64
            file_bytes = base64.b64decode(file_content)

        # Create media upload
        media = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype=mime_type,
            resumable=True
        )

        def upload_file():
            return service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, mimeType, size, webViewLink, webContentLink, createdTime'
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, upload_file)

        await _track_drive_usage(node_id, 'upload', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "file_id": result.get('id'),
                "name": result.get('name'),
                "mime_type": result.get('mimeType'),
                "size": result.get('size'),
                "web_link": result.get('webViewLink'),
                "download_link": result.get('webContentLink'),
                "created_time": result.get('createdTime'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Drive upload error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_drive_download(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Download a file from Google Drive.

    Parameters:
        file_id: ID of the file to download (required)
        output_format: 'base64' or 'url' (default: 'base64')
    """
    start_time = time.time()

    try:
        service = await _get_drive_service(parameters, context)

        file_id = parameters.get('file_id', '')
        output_format = parameters.get('output_format', 'base64')

        if not file_id:
            raise ValueError("File ID is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # Get file metadata first
        def get_metadata():
            return service.files().get(
                fileId=file_id,
                fields='id, name, mimeType, size, webViewLink, webContentLink'
            ).execute()

        loop = asyncio.get_event_loop()
        metadata = await loop.run_in_executor(None, get_metadata)

        if output_format == 'url':
            # Just return the download link
            await _track_drive_usage(node_id, 'download', 1, workflow_id, session_id)
            return {
                "success": True,
                "result": {
                    "file_id": metadata.get('id'),
                    "name": metadata.get('name'),
                    "mime_type": metadata.get('mimeType'),
                    "size": metadata.get('size'),
                    "download_url": metadata.get('webContentLink'),
                    "web_link": metadata.get('webViewLink'),
                },
                "execution_time": time.time() - start_time
            }

        # Download file content
        def download_file():
            request = service.files().get_media(fileId=file_id)
            file_buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(file_buffer, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            return file_buffer.getvalue()

        file_bytes = await loop.run_in_executor(None, download_file)

        # Encode as base64
        import base64
        file_base64 = base64.b64encode(file_bytes).decode('utf-8')

        await _track_drive_usage(node_id, 'download', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "file_id": metadata.get('id'),
                "name": metadata.get('name'),
                "mime_type": metadata.get('mimeType'),
                "size": len(file_bytes),
                "content_base64": file_base64,
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Drive download error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_drive_list(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """List files in Google Drive.

    Parameters:
        folder_id: Folder ID to list (optional, default: root)
        query: Search query using Drive query syntax (optional)
        max_results: Maximum number of files (default: 20, max: 1000)
        file_types: Filter by file type - 'all', 'folder', 'document', 'spreadsheet', 'image' (optional)
        order_by: Sort order - 'name', 'modifiedTime', 'createdTime' (default: 'modifiedTime desc')
    """
    start_time = time.time()

    try:
        service = await _get_drive_service(parameters, context)

        folder_id = parameters.get('folder_id', '')
        query = parameters.get('query', '')
        max_results = min(parameters.get('max_results', 20), 1000)
        file_types = parameters.get('file_types', 'all')
        order_by = parameters.get('order_by', 'modifiedTime desc')

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        # Build query
        query_parts = []

        if folder_id:
            query_parts.append(f"'{folder_id}' in parents")

        if query:
            query_parts.append(query)

        # File type filters
        if file_types == 'folder':
            query_parts.append("mimeType = 'application/vnd.google-apps.folder'")
        elif file_types == 'document':
            query_parts.append("mimeType = 'application/vnd.google-apps.document'")
        elif file_types == 'spreadsheet':
            query_parts.append("mimeType = 'application/vnd.google-apps.spreadsheet'")
        elif file_types == 'image':
            query_parts.append("mimeType contains 'image/'")

        # Don't list trashed files
        query_parts.append("trashed = false")

        full_query = ' and '.join(query_parts) if query_parts else None

        def list_files():
            params = {
                'pageSize': max_results,
                'fields': 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime, parents, owners)',
                'orderBy': order_by
            }
            if full_query:
                params['q'] = full_query
            return service.files().list(**params).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, list_files)

        files = result.get('files', [])
        formatted_files = []
        for f in files:
            formatted_files.append({
                "file_id": f.get('id'),
                "name": f.get('name'),
                "mime_type": f.get('mimeType'),
                "size": f.get('size'),
                "web_link": f.get('webViewLink'),
                "download_link": f.get('webContentLink'),
                "created_time": f.get('createdTime'),
                "modified_time": f.get('modifiedTime'),
                "parent_ids": f.get('parents', []),
                "owner": f.get('owners', [{}])[0].get('emailAddress') if f.get('owners') else None,
            })

        await _track_drive_usage(node_id, 'list', len(formatted_files), workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "files": formatted_files,
                "count": len(formatted_files),
                "next_page_token": result.get('nextPageToken'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Drive list error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_drive_share(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Share a file with another user.

    Parameters:
        file_id: ID of the file to share (required)
        email: Email address to share with (required)
        role: Permission role - 'reader', 'writer', 'commenter' (default: 'reader')
        send_notification: Send email notification (default: True)
        message: Custom message for notification (optional)
    """
    start_time = time.time()

    try:
        service = await _get_drive_service(parameters, context)

        file_id = parameters.get('file_id', '')
        email = parameters.get('email', '')
        role = parameters.get('role', 'reader')
        send_notification = parameters.get('send_notification', True)
        message = parameters.get('message', '')

        if not file_id:
            raise ValueError("File ID is required")
        if not email:
            raise ValueError("Email address is required")

        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        permission = {
            'type': 'user',
            'role': role,
            'emailAddress': email
        }

        def create_permission():
            return service.permissions().create(
                fileId=file_id,
                body=permission,
                sendNotificationEmail=send_notification,
                emailMessage=message if message else None,
                fields='id, type, role, emailAddress'
            ).execute()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, create_permission)

        # Get updated file info
        def get_file():
            return service.files().get(
                fileId=file_id,
                fields='id, name, webViewLink'
            ).execute()

        file_info = await loop.run_in_executor(None, get_file)

        await _track_drive_usage(node_id, 'share', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "permission_id": result.get('id'),
                "file_id": file_id,
                "file_name": file_info.get('name'),
                "shared_with": email,
                "role": role,
                "web_link": file_info.get('webViewLink'),
            },
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Drive share error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


# ============================================================================
# CONSOLIDATED DISPATCHER
# ============================================================================

async def handle_google_drive(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Consolidated Drive handler with operation dispatcher.

    Routes to appropriate handler based on 'operation' parameter:
    - upload: Upload file to Drive
    - download: Download file from Drive
    - list: List files in Drive
    - share: Share file with user
    """
    operation = parameters.get('operation', 'upload')

    if operation == 'upload':
        return await handle_drive_upload(node_id, node_type, parameters, context)
    elif operation == 'download':
        return await handle_drive_download(node_id, node_type, parameters, context)
    elif operation == 'list':
        return await handle_drive_list(node_id, node_type, parameters, context)
    elif operation == 'share':
        return await handle_drive_share(node_id, node_type, parameters, context)
    else:
        return {
            "success": False,
            "error": f"Unknown Drive operation: {operation}. Supported: upload, download, list, share",
            "execution_time": 0
        }
