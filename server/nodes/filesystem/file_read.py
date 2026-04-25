"""File Read — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class FileReadParams(BaseModel):
    file_path: str = Field(...)
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=2000, ge=1, le=10000)

    model_config = ConfigDict(extra="ignore")


class FileReadOutput(BaseModel):
    content: Optional[str] = None
    line_count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class FileReadNode(ActionNode):
    type = "fileRead"
    display_name = "File Read"
    subtitle = "Read Contents"
    icon = "📄"
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
        """Inlined from handlers/filesystem.py (Wave 11.D.1)."""
        import asyncio
        from ._backend import get_backend

        if not params.file_path:
            raise RuntimeError("file_path is required")
        backend = get_backend(params.model_dump(), ctx.raw)
        content = await asyncio.to_thread(
            backend.read, params.file_path,
            offset=params.offset, limit=params.limit,
        )
        return {"content": content, "file_path": params.file_path}
