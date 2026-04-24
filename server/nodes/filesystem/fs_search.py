"""FS Search — Wave 11.C migration. ls / glob / grep modes."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class FsSearchParams(BaseModel):
    # Pre-refactor contract: unknown mode raised "Unknown mode ..." from
    # the handler body rather than failing Pydantic validation.
    mode: str = Field(default="ls")
    path: str = Field(default=".")
    pattern: str = Field(default="")

    model_config = ConfigDict(extra="ignore")


class FsSearchOutput(BaseModel):
    matches: Optional[list] = None
    count: Optional[int] = None

    model_config = ConfigDict(extra="allow")


class FsSearchNode(ActionNode):
    type = "fsSearch"
    display_name = "FS Search"
    subtitle = "ls/glob/grep"
    icon = "🔍"
    color = "#8be9fd"
    group = ("filesystem", "tool")
    description = "Search the filesystem (ls, glob, grep)"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT
    usable_as_tool = True

    Params = FsSearchParams
    Output = FsSearchOutput

    @Operation("search")
    async def search(self, ctx: NodeContext, params: FsSearchParams) -> Any:
        """Inlined from handlers/filesystem.py (Wave 11.D.1)."""
        import asyncio
        from ._backend import get_backend

        backend = get_backend(params.model_dump(by_alias=True), ctx.raw)

        if params.mode == "ls":
            entries = await asyncio.to_thread(backend.ls_info, params.path)
            return {
                "path": params.path,
                "entries": [dict(e) for e in entries],
                "count": len(entries),
            }

        if params.mode == "glob":
            if not params.pattern:
                raise RuntimeError("pattern is required for glob mode")
            matches = await asyncio.to_thread(
                backend.glob_info, params.pattern, path=params.path,
            )
            return {
                "path": params.path,
                "pattern": params.pattern,
                "matches": [dict(m) for m in matches],
                "count": len(matches),
            }

        if params.mode == "grep":
            if not params.pattern:
                raise RuntimeError("pattern is required for grep mode")
            result = await asyncio.to_thread(
                backend.grep_raw, params.pattern, path=params.path,
            )
            if isinstance(result, str):
                raise RuntimeError(result)
            return {
                "path": params.path,
                "pattern": params.pattern,
                "matches": [dict(m) for m in result],
                "count": len(result),
            }

        raise RuntimeError(f"Unknown mode: {params.mode}")
