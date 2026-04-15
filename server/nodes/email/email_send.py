"""Email Send — Wave 11.C migration. SMTP via Himalaya CLI."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class EmailSendParams(BaseModel):
    provider: Literal[
        "gmail", "outlook", "yahoo", "icloud",
        "protonmail", "fastmail", "custom",
    ] = "gmail"
    to: str = Field(...)
    subject: str = Field(...)
    body: str = Field(default="", json_schema_extra={"rows": 6})
    cc: str = Field(default="")
    bcc: str = Field(default="")
    body_type: Literal["text", "html"] = Field(default="text", alias="bodyType")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class EmailSendOutput(BaseModel):
    sent: Optional[bool] = None
    message_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class EmailSendNode(ActionNode):
    type = "emailSend"
    display_name = "Email Send"
    subtitle = "SMTP Outbound"
    icon = "asset:send"
    color = "#8be9fd"
    group = ("email", "tool")
    description = "Send emails via SMTP (Gmail, Outlook, Yahoo, iCloud, ProtonMail, Fastmail, custom)"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.MESSAGING
    usable_as_tool = True

    Params = EmailSendParams
    Output = EmailSendOutput

    @Operation("send", cost={"service": "email", "action": "send", "count": 1})
    async def send(self, ctx: NodeContext, params: EmailSendParams) -> Any:
        from services.handlers.email import handle_email_send
        response = await handle_email_send(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Email send failed")
