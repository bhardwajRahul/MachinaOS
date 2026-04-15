"""Gmail Receive — Wave 11.B reference migration (polling trigger).

Polls the Gmail API on a configurable interval for new messages
matching a filter query. Delegates the actual poll loop to the
existing ``handlers/gmail.handle_gmail_receive`` — 11.B establishes the
plugin shell + schema; the full loop port lands in 11.C alongside the
other Google Workspace nodes so it can reuse the Connection facade for
OAuth refresh.

Replaces:
- ``server/nodes/triggers.py:gmailReceive`` metadata-only registration.
  The legacy handler + its entry in ``node_executor.py`` stay — plugin
  :meth:`execute` delegates to it, which is an explicit thin-wrapper
  pattern the plan accepts for this sub-wave.

Deployment-mode polling lifecycle (``deployment/manager.py``) is
unaffected: it checks ``node_type == 'gmailReceive'`` directly.
"""

from __future__ import annotations

from typing import Any, ClassVar, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import NodeContext, Operation, TaskQueue, TriggerNode


class GmailReceiveParams(BaseModel):
    filter_query: str = Field(
        default="is:unread",
        description="Gmail search query (e.g. 'is:unread from:boss@co.com')",
    )
    label_filter: str = Field(
        default="INBOX",
        description="Label to filter by (or 'all' to disable)",
    )
    mark_as_read: bool = False
    poll_interval: int = Field(default=60, ge=10, le=3600)

    model_config = ConfigDict(extra="ignore")


class GmailReceiveOutput(BaseModel):
    message_id: Optional[str] = None
    thread_id: Optional[str] = None
    from_: Optional[str] = Field(default=None, alias="from")
    to: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    snippet: Optional[str] = None
    date: Optional[str] = None
    labels: Optional[list] = None
    attachments: Optional[list] = None
    is_unread: Optional[bool] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class GmailReceiveNode(TriggerNode):
    type = "gmailReceive"
    display_name = "Gmail Receive"
    subtitle = "Inbound Email"
    icon = "asset:gmail"
    color = "#EA4335"
    group = ("google", "trigger")
    description = "Polling trigger for incoming Gmail emails"
    component_kind = "trigger"
    handles = (
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    # Google OAuth handled by the legacy google_auth helper during the
    # thin-delegation phase. 11.C converts this to a declarative
    # GoogleCredential subclass shared with gmail/calendar/drive/…
    task_queue = TaskQueue.TRIGGERS_POLL
    mode = "polling"
    default_poll_interval = 60

    Params = GmailReceiveParams
    Output = GmailReceiveOutput

    async def execute(
        self,
        node_id: str,
        parameters: Dict[str, Any],
        context: NodeContext,
    ) -> Dict[str, Any]:
        """Polling-trigger body inlined from handlers/gmail.py (Wave 11.D.5).

        Baseline → poll → dispatch. Private helpers
        (``_poll_gmail_ids`` / ``_fetch_email_details`` /
        ``_mark_email_as_read`` / ``_get_gmail_service`` /
        ``_track_gmail_usage``) stay in handlers/gmail.py because they
        are shared with gmail send/search/read operations — delete in
        11.D.13 along with the whole google handlers module.
        """
        import asyncio
        import time
        from datetime import datetime
        from core.logging import get_logger
        from services import event_waiter
        from services.handlers.gmail import (
            _get_gmail_service, _poll_gmail_ids,
            _fetch_email_details, _mark_email_as_read,
            _track_gmail_usage,
        )
        from services.status_broadcaster import get_status_broadcaster

        log = get_logger(__name__)
        start_time = time.time()
        try:
            service = await _get_gmail_service(parameters, context.raw)
            poll_interval = max(10, min(3600, parameters.get("poll_interval", 60)))
            filter_query = parameters.get("filter_query", "is:unread")
            label_filter = parameters.get("label_filter", "INBOX")
            mark_as_read = parameters.get("mark_as_read", False)

            query = filter_query
            if label_filter and label_filter != "all":
                query = f"label:{label_filter} {query}"

            await get_status_broadcaster().update_node_status(
                node_id, "waiting",
                {
                    "message": f"Waiting for Gmail email (polling every {poll_interval}s)...",
                    "event_type": "gmail_email_received",
                },
                workflow_id=context.workflow_id,
            )

            seen_ids = set()
            try:
                seen_ids.update(await _poll_gmail_ids(service, query))
                log.info(
                    f"[GmailReceive] Baseline: {len(seen_ids)} existing emails "
                    f"for query '{query}'",
                )
            except Exception as e:
                log.warning(
                    f"[GmailReceive] Baseline fetch failed (will treat all as new): {e}",
                )

            while True:
                await asyncio.sleep(poll_interval)
                try:
                    current_ids = await _poll_gmail_ids(service, query)
                    new_ids = current_ids - seen_ids
                    if not new_ids:
                        continue

                    newest_id = next(iter(new_ids))
                    seen_ids.update(new_ids)
                    email_data = await _fetch_email_details(service, newest_id)

                    if mark_as_read:
                        try:
                            await _mark_email_as_read(service, newest_id)
                        except Exception as e:
                            log.warning(f"[GmailReceive] Failed to mark as read: {e}")

                    await _track_gmail_usage(
                        node_id, "receive", 1,
                        context.workflow_id, context.session_id,
                    )
                    event_waiter.dispatch("gmail_email_received", email_data)
                    log.info(
                        f"[GmailReceive] New email found: "
                        f"{email_data.get('subject', 'no subject')}",
                    )
                    return {
                        "success": True, "node_id": node_id, "node_type": self.type,
                        "result": email_data,
                        "execution_time": time.time() - start_time,
                        "timestamp": datetime.now().isoformat(),
                    }
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    log.error(f"[GmailReceive] Poll error (will retry): {e}")

        except asyncio.CancelledError:
            log.info(f"[GmailReceive] Cancelled by user: node_id={node_id}")
            return {
                "success": False, "node_id": node_id, "node_type": self.type,
                "error": "Cancelled by user",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            log.error(f"[GmailReceive] Error: {e}")
            return {
                "success": False, "node_id": node_id, "node_type": self.type,
                "error": str(e),
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
            }

    @Operation("wait")
    async def wait(self, ctx: NodeContext, params: GmailReceiveParams) -> GmailReceiveOutput:
        raise NotImplementedError(
            "gmailReceive uses execute() override (Wave 11.D.5 inlined)."
        )
