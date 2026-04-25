"""WhatsApp loadOptions adapters.

Wave 6 Phase 4. Thin wrappers around the existing WhatsApp WS handlers
that normalise the response into the unified ``[{value, label}]`` shape
the frontend ``useLoadOptionsQuery`` consumes.

Today the editor talks to ``handle_whatsapp_groups`` /
``handle_whatsapp_newsletters`` / ``handle_whatsapp_group_info``
directly via dedicated WS message types. These adapters expose the
same data through the unified ``load_options`` dispatcher so the
``loadOptionsMethod`` schema field wires straight through with no
per-method WS handler. The legacy WS handlers stay live for back-compat.
"""

from typing import Any


async def load_whatsapp_groups(params: dict[str, Any]) -> list[dict[str, Any]]:
    """List WhatsApp groups for the recipient_type='group' selector."""

    from services.whatsapp_service import handle_whatsapp_groups as _wa_groups

    response = await _wa_groups()
    groups = response.get("groups", []) if isinstance(response, dict) else []
    return [
        {
            "value": g.get("group_jid") or g.get("id") or "",
            "label": g.get("name") or g.get("subject") or g.get("group_jid", ""),
        }
        for g in groups
    ]


async def load_whatsapp_channels(params: dict[str, Any]) -> list[dict[str, Any]]:
    """List subscribed newsletter channels for the channel_jid selector."""

    from services.whatsapp_service import handle_whatsapp_newsletters as _wa_newsletters

    response = await _wa_newsletters()
    channels = response.get("newsletters", []) if isinstance(response, dict) else []
    return [
        {
            "value": c.get("channel_jid") or c.get("id") or "",
            "label": c.get("name") or c.get("channel_jid", ""),
        }
        for c in channels
    ]


async def load_whatsapp_group_members(params: dict[str, Any]) -> list[dict[str, Any]]:
    """List members of a specific WhatsApp group for the senderNumber
    selector. Depends on ``params['group_id']``."""

    from services.whatsapp_service import handle_whatsapp_group_info as _wa_group_info

    group_id = params.get("group_id") or ""
    if not group_id:
        return []
    response = await _wa_group_info(group_id)
    participants = (
        response.get("participants", []) if isinstance(response, dict) else []
    )
    return [
        {
            "value": p.get("phone") or p.get("jid") or "",
            "label": p.get("name") or p.get("phone") or p.get("jid", ""),
        }
        for p in participants
    ]
