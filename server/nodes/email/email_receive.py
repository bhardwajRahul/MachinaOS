"""Email Receive — Wave 11.C migration (polling trigger).

IMAP polling for new mail via Himalaya CLI. Thin delegation to
``handle_email_receive`` which owns the poll loop + baseline tracking.
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import NodeContext, Operation, TaskQueue, TriggerNode


class EmailReceiveParams(BaseModel):
    provider: Literal[
        "gmail", "outlook", "yahoo", "icloud",
        "protonmail", "fastmail", "custom",
    ] = "gmail"
    folder: str = Field(default="INBOX")
    poll_interval: int = Field(default=60, ge=30, le=3600)
    filter_query: str = Field(default="")
    mark_as_read: bool = False

    model_config = ConfigDict(extra="ignore")


class EmailReceiveOutput(BaseModel):
    message_id: Optional[str] = None
    subject: Optional[str] = None
    from_: Optional[str] = Field(default=None, alias="from")
    body: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class EmailReceiveNode(TriggerNode):
    type = "emailReceive"
    display_name = "Email Receive"
    subtitle = "IMAP Polling"
    icon = "asset:receive"
    color = "#8be9fd"
    group = ("email", "trigger")
    description = "Polling trigger for new emails via IMAP"
    component_kind = "trigger"
    handles = (
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    task_queue = TaskQueue.TRIGGERS_POLL
    mode = "polling"

    Params = EmailReceiveParams
    Output = EmailReceiveOutput

    async def execute(
        self,
        node_id: str,
        parameters: Dict[str, Any],
        context: NodeContext,
    ) -> Dict[str, Any]:
        from services.handlers.email import handle_email_receive
        return await handle_email_receive(
            node_id=node_id, node_type=self.type,
            parameters=parameters, context=context.raw,
        )

    @Operation("wait")
    async def wait(self, ctx: NodeContext, params: EmailReceiveParams) -> EmailReceiveOutput:
        raise NotImplementedError("Polling trigger uses execute() override")
