"""File Handler — Wave 11.C migration. Read/write/process files."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class FileHandlerParams(BaseModel):
    operation: Literal["read", "write", "append", "delete"] = "read"
    file_path: str = Field(..., alias="filePath")
    content: str = Field(default="")
    encoding: str = Field(default="utf-8")

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class FileHandlerOutput(BaseModel):
    operation: Optional[str] = None
    content: Optional[str] = None
    success: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class FileHandlerNode(ActionNode):
    type = "fileHandler"
    display_name = "File Handler"
    subtitle = "Read/Write Files"
    icon = "📁"
    color = "#bd93f9"
    group = ("text",)
    description = "Read, write, and process files"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": True, "readonly": False, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = FileHandlerParams
    Output = FileHandlerOutput

    @Operation("dispatch")
    async def dispatch(self, ctx: NodeContext, params: FileHandlerParams) -> Any:
        from core.container import container

        text_service = container.text_service()
        response = await text_service.execute_file_handler(
            ctx.node_id, params.model_dump(by_alias=True),
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "File handler failed")
