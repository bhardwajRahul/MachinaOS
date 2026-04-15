"""File Downloader — Wave 11.C migration."""

from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

from ._helpers import delegate


class FileDownloaderParams(BaseModel):
    urls: List[str] = Field(default_factory=list)
    output_dir: str = Field(default="downloads", alias="outputDir")
    max_workers: int = Field(default=4, alias="maxWorkers", ge=1, le=32)
    skip_existing: bool = Field(default=True, alias="skipExisting")
    timeout: int = Field(default=60, ge=1, le=600)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class FileDownloaderOutput(BaseModel):
    downloaded: Optional[list] = None
    skipped: Optional[list] = None
    failed: Optional[list] = None

    model_config = ConfigDict(extra="allow")


class FileDownloaderNode(ActionNode):
    type = "fileDownloader"
    display_name = "File Downloader"
    subtitle = "Parallel DL"
    icon = "⬇️"
    color = "#bd93f9"
    group = ("document",)
    description = "Download files from URLs in parallel"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.REST_API

    Params = FileDownloaderParams
    Output = FileDownloaderOutput

    @Operation("download")
    async def download(self, ctx: NodeContext, params: FileDownloaderParams) -> Any:
        from services.handlers.document import handle_file_downloader
        return await delegate(
            handle_file_downloader, node_type=self.type, node_id=ctx.node_id,
            payload=params.model_dump(by_alias=True), context=ctx.raw,
        )
