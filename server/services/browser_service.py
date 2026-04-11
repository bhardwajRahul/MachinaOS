"""Thin wrapper around agent-browser CLI.

Stateless client — finds the binary via npx, runs commands via subprocess,
parses JSON output. The agent-browser daemon manages its own lifecycle
(auto-starts, persists between commands).

Invocation strategy
-------------------
agent-browser is a pinned project dependency (see package.json). Rather than
locating its shim manually per-platform, we invoke it via ``npx --no-install``:

    [shutil.which("npx"), "--no-install", "agent-browser", ...args]

This matches the pattern used by ``claude_code_service.py`` and is how npm
intends locally-pinned CLIs to be invoked. npx handles all the
cross-platform concerns (local ``node_modules/.bin/`` resolution, Windows
.CMD vs POSIX shell shim, shebang interpretation) so we don't have to.

``--no-install`` makes the call fail loudly if agent-browser isn't in the
lockfile, instead of silently pulling from the registry at runtime.

All subprocess calls use ``shell=False`` with list argv — Python handles
Windows .CMD files natively via ``CreateProcessW``, avoiding the BatBadBut
(CVE-2024-1874) argument-escaping vulnerabilities that plague shell=True.
"""

import asyncio
import json
import shutil
import subprocess
from typing import Any, Dict, List, Optional

import psutil

from core.logging import get_logger

logger = get_logger(__name__)

_MAX_OUTPUT = 100_000


def _kill_process_tree(pid: int) -> None:
    """Terminate a process and all its descendants (cross-platform via psutil).

    Fast-exiting processes can race between ``Process(pid)`` and
    ``children()``, so every psutil call is defensively guarded.
    """
    try:
        parent = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return

    try:
        descendants = parent.children(recursive=True)
    except psutil.NoSuchProcess:
        descendants = []

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
    """Subprocess wrapper for the agent-browser CLI.

    Holds a frozen argv prefix (typically ``[npx_path, --no-install,
    agent-browser]``) plus the logic to spawn the daemon, read its first
    JSON line, and kill the tree.
    """

    def __init__(self, argv_prefix: List[str]) -> None:
        self._prefix = list(argv_prefix)

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
        argv = [
            *self._prefix,
            "--session", session,
            "--json",
        ]
        if headed:
            argv.append("--headed")
        if user_agent:
            argv.extend(["--user-agent", user_agent])
        if proxy:
            argv.extend(["--proxy", proxy])
        argv.extend(args)

        logger.debug("agent-browser exec", argv=argv)

        raw = await asyncio.to_thread(self._run_sync, argv, timeout, stdin)

        if len(raw) > _MAX_OUTPUT:
            raw = raw[:_MAX_OUTPUT] + "\n...(truncated)"

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"output": raw}

    @staticmethod
    def _run_sync(
        argv: List[str],
        timeout: int,
        stdin_data: Optional[bytes],
    ) -> str:
        """Spawn agent-browser, read first JSON line, kill the process tree.

        The daemon holds stdout open after emitting its result, so we cannot
        use communicate() or wait() — either would hang forever. Instead we
        readline() and then force-kill the tree.

        Uses ``shell=False`` unconditionally with a list argv. This is safe
        on every platform including .CMD files on Windows (handled natively
        by CreateProcessW since Python 3.7, hardened against BatBadBut in 3.12+).
        """
        proc = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE if stdin_data else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
        )

        try:
            if stdin_data and proc.stdin:
                proc.stdin.write(stdin_data)
                proc.stdin.close()

            # Read the first line — that's the JSON result.
            # The daemon keeps the process alive after this, so we must
            # not call communicate() or wait() before killing it.
            line = proc.stdout.readline().decode(errors="replace").strip()

            if not line:
                # No output — check stderr for errors.
                err = proc.stderr.read().decode(errors="replace").strip()
                raise RuntimeError(err or "agent-browser returned empty output")

            return line
        finally:
            # npx -> node -> agent-browser daemon -> Chromium. Killing only
            # proc.pid leaves the daemon orphaned. psutil.children(recursive=True)
            # walks the tree natively on every platform.
            _kill_process_tree(proc.pid)
            proc.wait()


# -- Module-level lazy singleton (NodeJSClient pattern) -----------------

_instance: Optional[BrowserService] = None


def _find_agent_browser_cmd() -> Optional[List[str]]:
    """Locate agent-browser via npx (pinned to project lockfile).

    Uses ``npx --no-install`` so the call fails loudly if the package is
    missing, rather than silently pulling from the registry at runtime.
    Returns None if npx itself is not on PATH (Node.js not installed).
    """
    npx = shutil.which("npx")
    if not npx:
        return None
    return [npx, "--no-install", "agent-browser"]


def get_browser_service() -> Optional[BrowserService]:
    """Return the BrowserService singleton, or None if agent-browser cannot be located."""
    global _instance
    if _instance is None:
        cmd = _find_agent_browser_cmd()
        if cmd:
            _instance = BrowserService(cmd)
    return _instance
