"""Google Drive — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class DriveParams(BaseModel):
    operation: Literal["upload", "download", "list", "share"] = "list"
    file_id: str = Field(default="", alias="fileId")
    file_name: str = Field(default="", alias="fileName")
    file_path: str = Field(default="", alias="filePath")
    folder_id: str = Field(default="", alias="folderId")
    mime_type: str = Field(default="", alias="mimeType")
    share_email: str = Field(default="", alias="shareEmail")
    share_role: Literal["reader", "writer", "commenter"] = Field(
        default="reader", alias="shareRole",
    )
    max_results: int = Field(default=20, alias="maxResults", ge=1, le=1000)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class DriveOutput(BaseModel):
    operation: Optional[str] = None
    file_id: Optional[str] = None
    files: Optional[list] = None
    download_path: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class DriveNode(ActionNode):
    type = "drive"
    display_name = "Drive"
    subtitle = "File Operations"
    icon = "asset:drive"
    color = "#0F9D58"
    group = ("google", "tool")
    description = "Google Drive upload / download / list / share files"
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

    Params = DriveParams
    Output = DriveOutput

    @Operation("dispatch", cost={"service": "drive", "action": "op", "count": 1})
    async def dispatch(self, ctx: NodeContext, params: DriveParams) -> Any:
        from services.handlers.drive import handle_google_drive
        response = await handle_google_drive(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "Drive op failed")
