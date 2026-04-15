"""Google Contacts — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ContactsParams(BaseModel):
    operation: Literal["create", "list", "search", "get", "update", "delete"] = "list"
    contact_id: str = Field(default="", alias="contactId")
    given_name: str = Field(default="", alias="givenName")
    family_name: str = Field(default="", alias="familyName")
    email: str = Field(default="")
    phone: str = Field(default="")
    query: str = Field(default="")
    max_results: int = Field(default=20, alias="maxResults", ge=1, le=1000)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ContactsOutput(BaseModel):
    operation: Optional[str] = None
    contact_id: Optional[str] = None
    contacts: Optional[list] = None

    model_config = ConfigDict(extra="allow")


class ContactsNode(ActionNode):
    type = "contacts"
    display_name = "Contacts"
    subtitle = "Contact Management"
    icon = "asset:contacts"
    color = "#4285F4"
    group = ("google", "tool")
    description = "Google Contacts create / list / search / get / update / delete"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = ContactsParams
    Output = ContactsOutput

    @Operation("dispatch", cost={"service": "contacts", "action": "op", "count": 1})
    async def dispatch(self, ctx: NodeContext, params: ContactsParams) -> Any:
        from services.handlers.contacts import handle_google_contacts
        response = await handle_google_contacts(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Contacts op failed")
