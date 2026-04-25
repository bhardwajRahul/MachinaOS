"""Python Executor — Wave 11.C migration."""

from __future__ import annotations

from typing import Any

from services.plugin import NodeContext, Operation

from ._base import CodeExecutorBase, CodeExecutorParams


class PythonExecutorNode(CodeExecutorBase):
    type = "pythonExecutor"
    display_name = "Python Executor"
    subtitle = "Run Python"
    icon = "asset:python"
    description = "Execute Python code for calculations, data processing, and automation"

    @Operation("execute")
    async def execute_op(self, ctx: NodeContext, params: CodeExecutorParams) -> Any:
        """Inlined from handlers/code.py (Wave 11.D.2).

        Executes user code in a restricted namespace with stdout capture.
        ``input_data`` exposes ``connected_outputs`` so upstream node
        results are reachable; ``workspace_dir`` is the per-workflow
        scratch directory.
        """
        import io
        import json as json_module
        import math

        if not params.code.strip():
            raise RuntimeError("No code provided")

        input_data = ctx.raw.get("connected_outputs") or {}
        stdout_capture = io.StringIO()

        def captured_print(*args, **kwargs):
            kwargs["file"] = stdout_capture
            print(*args, **kwargs)

        safe_builtins = {
            "abs": abs, "all": all, "any": any, "bool": bool,
            "dict": dict, "enumerate": enumerate, "filter": filter,
            "float": float, "int": int, "len": len, "list": list,
            "map": map, "max": max, "min": min, "print": captured_print,
            "range": range, "round": round, "set": set, "sorted": sorted,
            "str": str, "sum": sum, "tuple": tuple, "type": type, "zip": zip,
            "True": True, "False": False, "None": None,
            "math": math, "json": json_module,
        }
        namespace = {
            "__builtins__": safe_builtins,
            "input_data": input_data,
            "workspace_dir": ctx.workspace_dir or "",
            "output": None,
        }
        exec(params.code, namespace)  # noqa: S102 — sandboxed namespace
        return {
            "output": namespace.get("output"),
            "console_output": stdout_capture.getvalue(),
        }
