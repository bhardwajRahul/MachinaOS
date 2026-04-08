"""Thin wrapper around agent-browser CLI.

Stateless client — finds the binary, runs commands via subprocess, parses JSON output.
The agent-browser daemon manages its own lifecycle (auto-starts, persists between commands).
"""

import asyncio
import json
import shutil
from typing import Any, Dict, List, Optional

from core.logging import get_logger

logger = get_logger(__name__)

_MAX_OUTPUT = 100_000


class BrowserService:
    """Subprocess wrapper for the agent-browser CLI."""

    def __init__(self, binary: str) -> None:
        self._bin = binary

    async def run(
        self,
        args: List[str],
        session: str,
        timeout: int = 30,
        stdin: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """Execute an agent-browser command and return parsed JSON output."""
        cmd = [self._bin, "--session", session, "--json", *args]
        logger.debug("agent-browser exec", cmd=" ".join(cmd))

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE if stdin else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=stdin), timeout=timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise TimeoutError(f"Timed out after {timeout}s")

        if proc.returncode != 0:
            err = stderr.decode(errors="replace").strip()
            raise RuntimeError(err or f"Exit code {proc.returncode}")

        raw = stdout.decode(errors="replace").strip()
        if len(raw) > _MAX_OUTPUT:
            raw = raw[:_MAX_OUTPUT] + "\n...(truncated)"

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"output": raw}


# -- Module-level lazy singleton (NodeJSClient pattern) --

_instance: Optional[BrowserService] = None


def get_browser_service() -> Optional[BrowserService]:
    """Get the BrowserService singleton, or None if agent-browser is not installed."""
    global _instance
    if _instance is None:
        path = shutil.which("agent-browser")
        if path:
            _instance = BrowserService(path)
    return _instance
