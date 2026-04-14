"""Google Workspace loadOptions adapters.

Wave 6 Phase 4b. Adds dynamic-option loaders for the Gmail label
picker and Calendar list picker. Reuses
services/handlers/google_auth.get_google_credentials() so the OAuth
dance is identical to the workflow-execution path.

Adding more Google loaders (e.g. Drive folder picker, Sheets
spreadsheet picker) = one async function + one entry in this file's
exports + one line in services/node_option_loaders/__init__.py.
"""

import asyncio
from typing import Any


async def _google_service(api: str, version: str, params: dict[str, Any]):
    """Build a googleapiclient service under the right OAuth credentials.
    `params` may carry ``account_mode`` / ``customer_id`` (customer-mode
    multi-tenant) — falls back to owner tokens otherwise."""

    from googleapiclient.discovery import build

    from services.handlers.google_auth import get_google_credentials

    creds = await get_google_credentials(params, {})
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: build(api, version, credentials=creds))


async def load_gmail_labels(params: dict[str, Any]) -> list[dict[str, Any]]:
    """Gmail labels for the label-filter selector on gmailReceive and
    gmail (search)."""

    service = await _google_service("gmail", "v1", params)
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, lambda: service.users().labels().list(userId="me").execute())
    labels = response.get("labels", [])
    # Stable sort: system labels alphabetical first, then user labels.
    labels.sort(key=lambda l: (l.get("type") != "system", (l.get("name") or "").lower()))
    return [
        {"value": l["id"], "label": l.get("name") or l["id"]}
        for l in labels
    ]


async def load_google_calendar_list(params: dict[str, Any]) -> list[dict[str, Any]]:
    """Calendar list for the calendarId picker on calendar CRUD."""

    service = await _google_service("calendar", "v3", params)
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, lambda: service.calendarList().list().execute())
    entries = response.get("items", [])
    # Primary first, rest alphabetised.
    entries.sort(key=lambda c: (not c.get("primary", False), (c.get("summary") or "").lower()))
    return [
        {
            "value": c.get("id", ""),
            "label": c.get("summary") or c.get("id", ""),
            "description": "Primary" if c.get("primary") else c.get("description", ""),
        }
        for c in entries
    ]


async def load_google_drive_folders(params: dict[str, Any]) -> list[dict[str, Any]]:
    """Drive folders for the folderId picker on drive upload/list."""

    service = await _google_service("drive", "v3", params)
    loop = asyncio.get_event_loop()
    query = "mimeType='application/vnd.google-apps.folder' and trashed=false"
    response = await loop.run_in_executor(
        None,
        lambda: service.files()
        .list(q=query, fields="files(id, name, parents)", pageSize=200)
        .execute(),
    )
    folders = response.get("files", [])
    folders.sort(key=lambda f: (f.get("name") or "").lower())
    return [
        {"value": f.get("id", ""), "label": f.get("name") or f.get("id", "")}
        for f in folders
    ]


async def load_google_tasklists(params: dict[str, Any]) -> list[dict[str, Any]]:
    """Task lists for the tasklistId picker on tasks CRUD."""

    service = await _google_service("tasks", "v1", params)
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, lambda: service.tasklists().list().execute())
    lists = response.get("items", [])
    lists.sort(key=lambda l: (l.get("title") or "").lower())
    return [
        {"value": l.get("id", ""), "label": l.get("title") or l.get("id", "")}
        for l in lists
    ]
