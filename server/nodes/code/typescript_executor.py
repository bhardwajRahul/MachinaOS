"""TypeScript Executor — Wave 11.C migration."""

from __future__ import annotations

from typing import Any

from services.plugin import NodeContext, Operation

from ._base import CodeExecutorBase, CodeExecutorParams


class TypeScriptExecutorNode(CodeExecutorBase):
    type = "typescriptExecutor"
    display_name = "TypeScript Executor"
    subtitle = "Run TS"
    icon = "asset:typescript"
    description = "Execute TypeScript code via persistent Node.js server with type safety"

    @Operation("execute")
    async def execute_op(self, ctx: NodeContext, params: CodeExecutorParams) -> Any:
        """Inlined from handlers/code.py (Wave 11.D.2)."""
        from ._nodejs import get_nodejs_client

        if not params.code.strip():
            raise RuntimeError("No code provided")
        input_data = dict(ctx.raw.get("connected_outputs") or {})
        input_data["workspace_dir"] = ctx.workspace_dir or ""

        result = await get_nodejs_client().execute(
            code=params.code,
            input_data=input_data,
            timeout=params.timeout * 1000,
            language="typescript",
        )
        if not result.get("success"):
            raise RuntimeError(result.get("error") or "TypeScript executor failed")
        return {
            "output": result.get("output"),
            "console_output": result.get("console_output", ""),
        }
