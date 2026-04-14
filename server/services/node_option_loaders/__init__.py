"""Generic loadOptionsMethod dispatch registry.

Wave 6 Phase 4. Generalises the WhatsApp-only dynamic-options pattern
to a registry mirroring services/node_executor._build_handler_registry().

The editor calls a single endpoint:

    POST /api/nodes/options/{method}

with body ``{"node_type": "...", "params": {...}}`` and the dispatcher
looks up the registered async loader, invokes it, and returns the
resulting ``[{"value": ..., "label": ...}]`` list. WS mirror at
``load_options`` matches the Wave 3 handler convention.

Registering a new dynamic-option loader: define an async function in
its own module under this package, import it here, and add the entry
to ``LOAD_OPTIONS_REGISTRY``. No frontend change needed - the
``loadOptionsMethod`` string in the Pydantic ``Field(json_schema_extra=)``
is what wires it through.
"""

from typing import Any, Awaitable, Callable, Optional

from .google_loaders import (
    load_gmail_labels,
    load_google_calendar_list,
    load_google_drive_folders,
    load_google_tasklists,
)
from .whatsapp_loaders import (
    load_whatsapp_channels,
    load_whatsapp_group_members,
    load_whatsapp_groups,
)


# Async loader signature: (params: dict) -> list of {value, label, ...}
LoadOptionsFn = Callable[[dict[str, Any]], Awaitable[list[dict[str, Any]]]]


LOAD_OPTIONS_REGISTRY: dict[str, LoadOptionsFn] = {
    # WhatsApp - groups, channels, group members.
    "whatsappGroups": load_whatsapp_groups,
    "whatsappChannels": load_whatsapp_channels,
    "whatsappGroupMembers": load_whatsapp_group_members,
    # Google Workspace - Gmail labels, Calendar list, Drive folders, Tasks lists.
    "gmailLabels": load_gmail_labels,
    "googleCalendarList": load_google_calendar_list,
    "googleDriveFolders": load_google_drive_folders,
    "googleTasklists": load_google_tasklists,
}


async def dispatch_load_options(
    method: str, params: Optional[dict[str, Any]] = None
) -> list[dict[str, Any]]:
    """Look up and invoke a registered loader.

    Returns an empty list when the method isn't registered (matches
    n8n's tolerant fallback - the dropdown stays empty rather than
    erroring out)."""

    loader = LOAD_OPTIONS_REGISTRY.get(method)
    if loader is None:
        return []
    return await loader(params or {})


def list_load_options_methods() -> list[str]:
    """Stable alphabetised list of registered method names. The editor
    prefetches this once on boot so it knows which ``loadOptionsMethod``
    values are wired."""

    return sorted(LOAD_OPTIONS_REGISTRY.keys())
