"""Console — Wave 11.C migration.

Sink node that logs upstream outputs to the Console panel for
debugging. Reads ``connected_outputs`` + ``source_nodes`` injected
by ``NodeExecutor._dispatch`` (any plugin needing upstream data
declares its type in ``_NEEDS_CONNECTED_OUTPUTS``).

Delegates the actual log-formatting + broadcast to the existing
``handlers/utility.handle_console`` — that body is non-trivial
(JSON / table / expression formatting + WS broadcast) and stable,
so 11.C ports the shell only.
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from services.plugin import ActionNode, NodeContext, Operation, TaskQueue


class ConsoleParams(BaseModel):
    label: str = ""
    log_mode: Literal["all", "field", "expression"] = Field(
        default="all", alias="logMode",
    )
    field_path: str = Field(
        default="", alias="fieldPath",
        json_schema_extra={"displayOptions": {"show": {"log_mode": ["field"]}}},
    )
    expression: str = Field(
        default="",
        json_schema_extra={"displayOptions": {"show": {"log_mode": ["expression"]}}},
    )
    format: Literal["json", "json_compact", "text", "table"] = "json"

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ConsoleOutput(BaseModel):
    logged: Optional[Any] = None
    label: Optional[str] = None
    timestamp: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ConsoleNode(ActionNode):
    type = "console"
    display_name = "Console"
    subtitle = "Debug Logger"
    icon = "🖥️"
    color = "#8be9fd"
    group = ("utility",)
    description = "Log data to console panel for debugging during execution"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
    )
    hide_output_handle = True
    ui_hints = {"isConsoleSink": True}
    annotations = {"destructive": False, "readonly": True, "open_world": False}
    task_queue = TaskQueue.DEFAULT

    Params = ConsoleParams
    Output = ConsoleOutput

    @Operation("log")
    async def log(self, ctx: NodeContext, params: ConsoleParams) -> Any:
        from services.handlers.utility import handle_console
        outputs = ctx.raw.get("connected_outputs") or {}
        source_nodes = ctx.raw.get("source_nodes") or []
        response = await handle_console(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True),
            context=ctx.raw,
            connected_outputs=outputs,
            source_nodes=source_nodes,
        )
        if response.get("success") is False:
            raise RuntimeError(response.get("error") or "console log failed")
        return response.get("result") or {}
