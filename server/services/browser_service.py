"""Thin wrapper around agent-browser CLI.

Stateless client — finds the binary, runs commands via subprocess, parses JSON output.
The agent-browser daemon manages its own lifecycle (auto-starts, persists between commands).
"""

import asyncio
import json
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional

import psutil

from core.logging import get_logger

logger = get_logger(__name__)

_MAX_OUTPUT = 100_000


def _kill_process_tree(pid: int) -> None:
    """Terminate a process and all its descendants (cross-platform via psutil)."""
    try:
        parent = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return

    # Collect descendants before killing parent so we don't lose the tree.
    descendants = parent.children(recursive=True)
    for child in descendants:
        try:
            child.kill()
        except psutil.NoSuchProcess:
            pass

    try:
        parent.kill()
    except psutil.NoSuchProcess:
        pass


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
        headed: bool = False,
        user_agent: Optional[str] = None,
        proxy: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute an agent-browser command and return parsed JSON output.

        agent-browser outputs JSON on the first stdout line then keeps the
        daemon process alive. We read just the first line via Popen in a
        thread, then kill the process — never wait for exit.
        """
        parts = [self._bin, "--session", session, "--json"]
        if headed:
            parts.append("--headed")
        if user_agent:
            parts.extend(["--user-agent", user_agent])
        if proxy:
            parts.extend(["--proxy", proxy])
        parts.extend(args)

        logger.debug("agent-browser exec", cmd=" ".join(parts))

        raw = await asyncio.to_thread(
            self._run_sync, parts, timeout, stdin
        )

        if len(raw) > _MAX_OUTPUT:
            raw = raw[:_MAX_OUTPUT] + "\n...(truncated)"

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"output": raw}

    @staticmethod
    def _run_sync(
        parts: List[str],
        timeout: int,
        stdin_data: Optional[bytes],
    ) -> str:
        """Run agent-browser, read first JSON line, kill process.

        agent-browser daemon keeps stdout open after printing the result.
        communicate() would hang forever. Instead: readline() + kill().
        On Windows, shell=True is required (.CMD wrapper).
        """
        is_win = sys.platform == "win32"
        cmd = " ".join(parts) if is_win else parts

        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE if stdin_data else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=is_win,
        )

        try:
            if stdin_data and proc.stdin:
                proc.stdin.write(stdin_data)
                proc.stdin.close()

            # Read the first line — that's the JSON result.
            # The daemon keeps the process alive after this, so
            # we must not call communicate() or wait().
            line = proc.stdout.readline().decode(errors="replace").strip()

            if not line:
                # No output — check stderr for errors
                err = proc.stderr.read().decode(errors="replace").strip()
                raise RuntimeError(err or "agent-browser returned empty output")

            return line
        finally:
            # With shell=True on Windows, proc is the shell wrapper (cmd.exe)
            # and the real agent-browser daemon runs as its child. Killing only
            # proc leaves the daemon orphaned. psutil.children(recursive=True)
            # walks the process tree natively on every platform.
            _kill_process_tree(proc.pid)
            proc.wait()


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
