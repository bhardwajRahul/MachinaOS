"""File Modify — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class FileModifyParams(BaseModel):
    operation: Literal["write", "edit"] = "write"
    file_path: str = Field(..., alias="filePath")
    content: str = Field(default="")
    old_string: str = Field(default="", alias="oldString")
    new_string: str = Field(default="", alias="newString")
    replace_all: bool = Field(default=False, alias="replaceAll")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class FileModifyOutput(BaseModel):
    written: Optional[bool] = None
    replacements: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class FileModifyNode(ActionNode):
    type = "fileModify"
    display_name = "File Modify"
    subtitle = "Write/Edit"
    icon = "✏️"
    color = "#8be9fd"
    group = ("filesystem", "tool")
    description = "Write new files or edit existing files"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": True, "readonly": False, "open_world": False}
    task_queue = TaskQueue.DEFAULT
    usable_as_tool = True

    Params = FileModifyParams
    Output = FileModifyOutput

    @Operation("modify")
    async def modify(self, ctx: NodeContext, params: FileModifyParams) -> Any:
        from services.handlers.filesystem import handle_file_modify
        response = await handle_file_modify(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "File modify failed")
