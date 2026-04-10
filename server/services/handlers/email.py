"""Email node handlers - thin wrappers around EmailService."""

import asyncio
import time
from datetime import datetime
from typing import Any, Dict, Set

from core.logging import get_logger

logger = get_logger(__name__)


def _ok(node_id, node_type, result, start):
    return {"success": True, "node_id": node_id, "node_type": node_type,
            "result": result, "execution_time": time.time() - start,
            "timestamp": datetime.now().isoformat()}


def _err(node_id, node_type, error, start):
    return {"success": False, "node_id": node_id, "node_type": node_type,
            "error": str(error), "execution_time": time.time() - start,
            "timestamp": datetime.now().isoformat()}


async def handle_email_send(node_id, node_type, parameters, context):
    from services.email_service import get_email_service
    t = time.time()
    try:
        return _ok(node_id, node_type, await get_email_service().send(parameters), t)
    except Exception as e:
        logger.error(f"[EmailSend] {e}")
        return _err(node_id, node_type, e, t)


async def handle_email_read(node_id, node_type, parameters, context):
    from services.email_service import get_email_service
    t = time.time()
    try:
        return _ok(node_id, node_type, await get_email_service().read(parameters), t)
    except Exception as e:
        logger.error(f"[EmailRead] {e}")
        return _err(node_id, node_type, e, t)


async def handle_email_receive(node_id, node_type, parameters, context):
    """Polling trigger - baseline + poll loop (gmailReceive pattern)."""
    from services.email_service import get_email_service
    from services.status_broadcaster import get_status_broadcaster
    t = time.time()
    try:
        svc = get_email_service()
        creds = await svc.resolve_credentials(parameters)
        poll = svc.resolve_poll_params(parameters)

        await get_status_broadcaster().update_node_status(node_id, "waiting", {
            "message": f"Waiting for email (every {poll['interval']}s)...",
            "event_type": "email_received",
        }, workflow_id=context.get("workflow_id"))

        seen: Set[str] = await svc.poll_ids(creds, poll["folder"])
        logger.info(f"[EmailReceive] Baseline: {len(seen)} emails in {poll['folder']}")

        while True:
            await asyncio.sleep(poll["interval"])
            new_ids = await svc.poll_ids(creds, poll["folder"]) - seen
            if not new_ids:
                continue

            msg_id = next(iter(new_ids))
            seen.update(new_ids)
            email_data = await svc.fetch_detail(creds, msg_id, poll["folder"])

            if poll["mark_as_read"]:
                d = svc.defaults
                await svc.himalaya.flag_message(
                    creds, msg_id, d.get("flag"), d.get("flag_action"), poll["folder"])

            from services import event_waiter
            event_waiter.dispatch("email_received", email_data)
            return _ok(node_id, node_type, email_data, t)

    except asyncio.CancelledError:
        return _err(node_id, node_type, "Cancelled by user", t)
    except Exception as e:
        logger.error(f"[EmailReceive] {e}")
        return _err(node_id, node_type, e, t)
