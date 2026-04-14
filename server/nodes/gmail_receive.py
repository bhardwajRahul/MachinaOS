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
        """Delegate to the legacy polling handler. Keeps the 100 LOC
        poll loop + OAuth refresh intact while this sub-wave proves the
        plugin shell. 11.C ports the loop into :meth:`poll_once`.
        """
        from services.handlers.gmail import handle_gmail_receive
        return await handle_gmail_receive(
            node_id=node_id,
            node_type=self.type,
            parameters=parameters,
            context=context.raw,
        )

    # Declare a no-op operation so the contract invariants are happy.
    # The :meth:`execute` override above pre-empts dispatch.
    @Operation("wait")
    async def wait(self, ctx: NodeContext, params: GmailReceiveParams) -> GmailReceiveOutput:
        raise NotImplementedError(
            "gmailReceive uses execute() override (thin delegation). "
            "Port into poll_once() lands in Wave 11.C."
        )
