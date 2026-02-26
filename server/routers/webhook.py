"""Dynamic webhook endpoint router for incoming HTTP requests.

Works like WhatsApp trigger - uses broadcaster.send_custom_event() to dispatch
to event_waiter which resolves waiting trigger nodes.
"""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from typing import Dict
import asyncio
import logging

from services.status_broadcaster import get_status_broadcaster

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["webhook"])

# Pending responses: path -> asyncio.Future (for responseNode mode)
_pending_responses: Dict[str, asyncio.Future] = {}


def resolve_webhook_response(node_id: str, response_data: dict):
    """Resolve a pending webhook response.

    Called by webhookResponse node execution to send response back to caller.
    Uses path from response_data to find the pending Future.
    """
    # Find pending response by path (stored when we started waiting)
    for path, future in list(_pending_responses.items()):
        if not future.done():
            future.set_result(response_data)
            logger.info(f"[Webhook] Response resolved for path: {path}")
            return

    logger.warning(f"[Webhook] No pending response found for node: {node_id}")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def handle_webhook(path: str, request: Request):
    """Handle incoming webhook requests.

    Dispatches webhook_received event to trigger waiting webhookTrigger nodes.
    Similar to how WhatsApp events dispatch to whatsappReceive nodes.
    """
    # Build webhook request data
    body = await request.body()
    json_body = None
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type and body:
        try:
            json_body = await request.json()
        except Exception:
            pass

    webhook_data = {
        "method": request.method,
        "path": path,
        "headers": dict(request.headers),
        "query": dict(request.query_params),
        "body": body.decode('utf-8') if isinstance(body, bytes) else (body if body else ""),
        "json": json_body
    }

    logger.info(f"[Webhook] Received: {request.method} /webhook/{path}")

    # Dispatch event using broadcaster (same pattern as WhatsApp)
    broadcaster = get_status_broadcaster()
    await broadcaster.send_custom_event("webhook_received", webhook_data)

    # For now, always return immediate response
    # TODO: Support responseNode mode by storing Future and waiting
    return JSONResponse(
        content={
            "status": "received",
            "path": path,
            "message": "Webhook received and dispatched to workflow"
        },
        status_code=200
    )


@router.get("/")
async def list_info():
    """Get webhook endpoint info."""
    return {
        "endpoint": "/webhook/{path}",
        "description": "Send HTTP requests to trigger webhookTrigger nodes",
        "usage": "Deploy a workflow with webhookTrigger node, then send requests to /webhook/{path}",
        "example": "POST /webhook/my-webhook with JSON body"
    }
