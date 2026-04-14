"""Gmail — Wave 11.B reference migration (multi-op ActionNode).

Demonstrates the ``@Operation`` dispatch pattern: three operations
(send / search / read) declared as methods, dispatched on
``parameters.operation`` automatically by :class:`BaseNode._pick_operation`.

Replaces:
- ``server/nodes/services.py:gmail`` metadata-only registration
  (removed).
- Legacy ``node_executor.py`` routes ``gmail`` → plugin handler via
  the additive plugin registry merge — no code change in the executor.

Per-op bodies delegate to the existing Google-auth + Google-API-client
code in ``handlers/gmail.py``. 11.E converts to a declarative
``GoogleCredential`` shared with calendar/drive/sheets.

This migration also keeps the tool-mode path intact —
``handlers/tools.py`` calls ``handle_google_gmail`` directly for
AI-agent-invoked gmail operations. 11.D unifies that path.
"""

from __future__ import annotations

from typing import Any, ClassVar, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class GmailParams(BaseModel):
    """All three ops share one Params model — per-field gating via
    ``displayOptions.show`` hides irrelevant UI rows in the parameter
    panel, same pattern the legacy ``GmailParams`` uses."""

    operation: Literal["send", "search", "read"] = "send"

    # send
    to: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["send"]}}},
    )
    subject: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"operation": ["send"]}}},
    )
    body: str = Field(
        default="",
        json_schema_extra={
            "rows": 4,
            "placeholder": "Write your message...",
            "displayOptions": {"show": {"operation": ["send"]}},
        },
    )

    # search
    query: str = Field(
        default="",
        json_schema_extra={
            "placeholder": "from:jane subject:meeting",
            "displayOptions": {"show": {"operation": ["search"]}},
        },
    )

    # read
    message_id: str = Field(
        default="",
        alias="messageId",
        json_schema_extra={"displayOptions": {"show": {"operation": ["read"]}}},
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class GmailOutput(BaseModel):
    operation: Optional[str] = None
    message_id: Optional[str] = None
    thread_id: Optional[str] = None
    emails: Optional[list] = None
    count: Optional[int] = None
    subject: Optional[str] = None
    from_: Optional[str] = Field(default=None, alias="from")
    to: Optional[str] = None
    date: Optional[str] = None
    body: Optional[str] = None
    snippet: Optional[str] = None
    labels: Optional[list] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class GmailNode(ActionNode):
    type = "gmail"
    display_name = "Gmail"
    subtitle = "Email Operations"
    icon = "asset:gmail"
    color = "#EA4335"
    group = ("google", "tool")
    description = "Google Gmail send / search / read (dual-purpose workflow + AI tool)"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    # Google OAuth stays on the legacy ``google_auth`` helper during
    # thin-delegation phase. 11.E introduces ``GoogleCredential``.
    credentials = ()
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = GmailParams
    Output = GmailOutput

    @Operation("send", cost={"service": "gmail", "action": "send", "count": 1})
    async def send(self, ctx: NodeContext, params: GmailParams) -> Dict[str, Any]:
        from services.handlers.gmail import handle_gmail_send
        return await self._delegate(handle_gmail_send, ctx, params)

    @Operation("search", cost={"service": "gmail", "action": "search", "count": 1})
    async def search(self, ctx: NodeContext, params: GmailParams) -> Dict[str, Any]:
        from services.handlers.gmail import handle_gmail_search
        return await self._delegate(handle_gmail_search, ctx, params)

    @Operation("read", cost={"service": "gmail", "action": "read", "count": 1})
    async def read(self, ctx: NodeContext, params: GmailParams) -> Dict[str, Any]:
        from services.handlers.gmail import handle_gmail_read
        return await self._delegate(handle_gmail_read, ctx, params)

    async def _delegate(self, handler, ctx: NodeContext, params: GmailParams) -> Any:
        """Call a legacy handler with the original ``parameters`` dict,
        unwrap its ``{success, result, ...}`` envelope, return just the
        ``result`` — :meth:`BaseNode._wrap_success` re-wraps.
        """
        payload = params.model_dump(by_alias=True)
        response = await handler(
            node_id=ctx.node_id, node_type=self.type,
            parameters=payload, context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        # Surface failure via the BaseNode error path.
        raise RuntimeError(response.get("error") or "gmail operation failed")
