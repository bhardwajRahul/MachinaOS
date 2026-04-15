"""FS Search — Wave 11.C migration. ls / glob / grep modes."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class FsSearchParams(BaseModel):
    mode: Literal["ls", "glob", "grep"] = "ls"
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
        from services.handlers.filesystem import handle_fs_search
        response = await handle_fs_search(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True), context=ctx.raw,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "FS search failed")
