"""Email Read — Wave 11.C migration. IMAP via Himalaya CLI."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class EmailReadParams(BaseModel):
    provider: Literal[
        "gmail", "outlook", "yahoo", "icloud",
        "protonmail", "fastmail", "custom",
    ] = "gmail"
    operation: Literal["list", "search", "read", "folders", "move", "delete", "flag"] = "list"
    folder: str = Field(default="INBOX")
    query: str = Field(default="")
    message_id: str = Field(default="", alias="messageId")
    target_folder: str = Field(default="", alias="targetFolder")
    flag: str = Field(default="")
    limit: int = Field(default=20, ge=1, le=500)

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class EmailReadOutput(BaseModel):
    operation: Optional[str] = None
    messages: Optional[list] = None
    folders: Optional[list] = None
    body: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class EmailReadNode(ActionNode):
    type = "emailRead"
    display_name = "Email Read"
    subtitle = "IMAP Read/Manage"
    icon = "asset:read"
    color = "#8be9fd"
    group = ("email", "tool")
    description = "Read and manage emails via IMAP - list, search, read, move, delete, flag"
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

    Params = EmailReadParams
    Output = EmailReadOutput

    @Operation("query", cost={"service": "email", "action": "imap", "count": 1})
    async def query(self, ctx: NodeContext, params: EmailReadParams) -> Any:
        from services.handlers.email import handle_email_read
        response = await handle_email_read(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Email read failed")
