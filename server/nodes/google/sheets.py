"""Google Sheets — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class SheetsParams(BaseModel):
    operation: Literal["read", "write", "append"] = "read"
    spreadsheet_id: str = Field(default="", alias="spreadsheetId")
    range: str = Field(default="A1:Z1000")
    values: List[List[Any]] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class SheetsOutput(BaseModel):
    operation: Optional[str] = None
    rows: Optional[list] = None
    updated_cells: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class SheetsNode(ActionNode):
    type = "sheets"
    display_name = "Sheets"
    subtitle = "Spreadsheet Ops"
    icon = "asset:sheets"
    color = "#0F9D58"
    group = ("google", "tool")
    description = "Google Sheets read / write / append spreadsheet data"
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

    Params = SheetsParams
    Output = SheetsOutput

    @Operation("dispatch", cost={"service": "sheets", "action": "op", "count": 1})
    async def dispatch(self, ctx: NodeContext, params: SheetsParams) -> Any:
        from services.handlers.sheets import handle_google_sheets
        response = await handle_google_sheets(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Sheets op failed")
