"""Python Executor — Wave 11.C migration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from services.plugin import NodeContext, Operation

from ._base import CodeExecutorBase, CodeExecutorParams


class PythonExecutorNode(CodeExecutorBase):
    type = "pythonExecutor"
    display_name = "Python Executor"
    subtitle = "Run Python"
    icon = "🐍"
    description = "Execute Python code for calculations, data processing, and automation"

    @Operation("execute")
    async def execute_op(self, ctx: NodeContext, params: CodeExecutorParams) -> Any:
        """Inlined from handlers/code.py (Wave 11.D.2).

        Executes user code in a restricted namespace with stdout capture.
        ``input_data`` exposes ``connected_outputs`` so upstream node
        results are reachable; ``workspace_dir`` is the per-workflow
        scratch directory.
        """
        import collections
        import datetime as datetime_module
        import io
        import json as json_module
        import math
        import random
        import re

        if not params.code.strip():
            raise RuntimeError("No code provided")

        input_data = ctx.raw.get("connected_outputs") or {}
        stdout_capture = io.StringIO()

        def captured_print(*args, **kwargs):
            kwargs["file"] = stdout_capture
            print(*args, **kwargs)

        import builtins as _builtins_module

        builtins_dict = dict(_builtins_module.__dict__)
        builtins_dict["print"] = captured_print

        namespace = {
            "__builtins__": builtins_dict,
            "input_data": input_data,
            "workspace_dir": ctx.workspace_dir or "",
            "output": None,
            "math": math,
            "json": json_module,
            "datetime": datetime_module.datetime,
            "timedelta": datetime_module.timedelta,
            "collections": collections,
            "Counter": collections.Counter,
            "defaultdict": collections.defaultdict,
            "re": re,
            "random": random,
        }
        exec(params.code, namespace)  # noqa: S102 -- sandboxed namespace
        return {
            "output": namespace.get("output"),
            "console_output": stdout_capture.getvalue(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
