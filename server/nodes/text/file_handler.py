"""File Handler — Wave 11.C migration.

Content-metadata wrapper (NOT file I/O). Takes a text content blob plus
file-type / file-name metadata and returns a wrapped ``{type: "file",
data: {...}}`` envelope for downstream nodes. Actual file I/O lives in
``nodes/filesystem/file_read`` / ``file_modify``.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class FileHandlerParams(BaseModel):
    file_type: Literal[
        "generic", "markdown", "text", "json", "csv", "html", "xml",
    ] = Field(
        default="generic",
        description="Content type tag used for downstream processing hints.",
    )
    file_name: str = Field(
        default="untitled.txt",
        description="Filename label attached to the wrapped content.",
    )
    content: str = Field(
        default="",
        description="Text content to wrap.",
        json_schema_extra={"rows": 8},
    )

    model_config = ConfigDict(extra="ignore")


class FileHandlerOutput(BaseModel):
    type: Optional[str] = None
    data: Optional[dict] = None
    node_id: Optional[str] = None
    timestamp: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class FileHandlerNode(ActionNode):
    type = "fileHandler"
    display_name = "File Handler"
    subtitle = "Wrap Content Metadata"
    icon = "lucide:Folder"
    color = "#bd93f9"
    group = ("text",)
    description = "Wrap text content with file-type / file-name metadata"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = FileHandlerParams
    Output = FileHandlerOutput

    @Operation("wrap")
    async def wrap(self, ctx: NodeContext, params: FileHandlerParams) -> Any:
        from core.container import container

        text_service = container.text_service()
        # TextService.execute_file_handler uses camelCase keys by
        # historical contract (the result dict it emits is served to
        # the frontend with camelCase field names too). Translate our
        # snake_case Params to the service's expected shape.
        response = await text_service.execute_file_handler(
            ctx.node_id,
            {
                "fileType": params.file_type,
                "fileName": params.file_name,
                "content": params.content,
            },
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "File handler failed")
