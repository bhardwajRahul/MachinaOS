"""TypeScript Executor — Wave 11.C migration."""

from __future__ import annotations

from typing import Any

from services.plugin import NodeContext, Operation

from ._base import CodeExecutorBase, CodeExecutorParams


class TypeScriptExecutorNode(CodeExecutorBase):
    type = "typescriptExecutor"
    display_name = "TypeScript Executor"
    subtitle = "Run TS"
    icon = "📘"
    description = "Execute TypeScript code via persistent Node.js server with type safety"

    @Operation("execute")
    async def execute_op(self, ctx: NodeContext, params: CodeExecutorParams) -> Any:
        from services.handlers.code import handle_typescript_executor
        outputs = ctx.raw.get("connected_outputs") or {}
        response = await handle_typescript_executor(
            node_id=ctx.node_id, node_type=self.type,
            parameters=params.model_dump(by_alias=True),
            context=ctx.raw, connected_outputs=outputs,
        )
        if response.get("success"):
            return response.get("result") or response
        raise RuntimeError(response.get("error") or "TypeScript executor failed")
