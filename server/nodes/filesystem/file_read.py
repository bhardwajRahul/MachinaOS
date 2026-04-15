"""File Read — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class FileReadParams(BaseModel):
    file_path: str = Field(..., alias="filePath")
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=2000, ge=1, le=10000)

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class FileReadOutput(BaseModel):
    content: Optional[str] = None
    line_count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class FileReadNode(ActionNode):
    type = "fileRead"
    display_name = "File Read"
    subtitle = "Read Contents"
    icon = "📖"
    color = "#8be9fd"
    group = ("filesystem", "tool")
    description = "Read file contents with line numbers and pagination"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT
    usable_as_tool = True

    Params = FileReadParams
    Output = FileReadOutput

    @Operation("read")
    async def read(self, ctx: NodeContext, params: FileReadParams) -> Any:
        from services.handlers.filesystem import handle_file_read
        response = await handle_file_read(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "File read failed")
