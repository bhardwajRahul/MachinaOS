"""File Modify — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


_WRITE = {"displayOptions": {"show": {"operation": ["write"]}}}
_EDIT = {"displayOptions": {"show": {"operation": ["edit"]}}}


class FileModifyParams(BaseModel):
    operation: Literal["write", "edit"] = "write"
    file_path: str = Field(...)
    content: str = Field(default="", json_schema_extra=_WRITE)
    old_string: str = Field(default="", json_schema_extra=_EDIT)
    new_string: str = Field(default="", json_schema_extra=_EDIT)
    replace_all: bool = Field(default=False, json_schema_extra=_EDIT)

    model_config = ConfigDict(extra="ignore")


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
        """Inlined from handlers/filesystem.py (Wave 11.D.1)."""
        import asyncio
        from ._backend import get_backend

        if not params.file_path:
            raise RuntimeError("file_path is required")
        backend = get_backend(params.model_dump(), ctx.raw)

        if params.operation == "write":
            result = await asyncio.to_thread(backend.write, params.file_path, params.content)
            if result.error:
                raise RuntimeError(result.error)
            return {"operation": "write", "file_path": result.path or params.file_path}

        if params.operation == "edit":
            if not params.old_string:
                raise RuntimeError("old_string is required for edit")
            result = await asyncio.to_thread(
                backend.edit, params.file_path, params.old_string, params.new_string,
                replace_all=params.replace_all,
            )
            if result.error:
                raise RuntimeError(result.error)
            return {
                "operation": "edit",
                "file_path": result.path or params.file_path,
                "occurrences": result.occurrences,
            }

        raise RuntimeError(f"Unknown operation: {params.operation}")
