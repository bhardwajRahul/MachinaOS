"""Claude Code service - manages CLI execution with session persistence."""

import asyncio
import json
import os
import shutil
from typing import Any, Dict, List, Optional

from core.logging import get_logger

logger = get_logger(__name__)


def _find_claude_cmd() -> List[str]:
    """Find claude CLI cross-platform."""
    if shutil.which("claude"):
        return ["claude"]
    npx = shutil.which("npx")
    if npx:
        return [npx, "-y", "@anthropic-ai/claude-code"]
    raise FileNotFoundError("Neither 'claude' nor 'npx' found in PATH")


class ClaudeCodeService:
    """Executes tasks via Claude Code CLI with session tracking."""

    def __init__(self):
        self._session_map: Dict[str, str] = {}  # node_id -> session_id

    async def execute(
        self,
        prompt: str,
        node_id: str = "",
        model: str = "claude-sonnet-4-6",
        cwd: Optional[str] = None,
        allowed_tools: str = "Read,Edit,Bash,Glob,Grep,Write",
        max_turns: int = 10,
        max_budget_usd: float = 5.0,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run claude CLI and return parsed JSON result."""
        cmd = _find_claude_cmd() + [
            "-p", prompt,
            "--output-format", "json",
            "--model", model,
            "--max-turns", str(max_turns),
            "--allowedTools", allowed_tools,
        ]

        if max_budget_usd > 0:
            cmd += ["--max-budget-usd", str(max_budget_usd)]

        # Resume existing session for this node
        session_id = self._session_map.get(node_id)
        if session_id:
            cmd += ["--resume", session_id]

        if system_prompt:
            cmd += ["--append-system-prompt", system_prompt]

        work_dir = cwd or os.getcwd()

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=work_dir,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)

        if proc.returncode != 0:
            err = stderr.decode("utf-8", errors="replace").strip()
            logger.error("Claude Code failed (exit %d): %s", proc.returncode, err)
            raise RuntimeError(err or f"Exit code {proc.returncode}")

        raw = stdout.decode("utf-8", errors="replace").strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"result": raw}

        # Track session for future resume
        if data.get("session_id") and node_id:
            self._session_map[node_id] = data["session_id"]

        return data

    def get_session_id(self, node_id: str) -> Optional[str]:
        return self._session_map.get(node_id)

    def clear_session(self, node_id: str) -> None:
        self._session_map.pop(node_id, None)


_instance: Optional[ClaudeCodeService] = None


def get_claude_code_service() -> ClaudeCodeService:
    global _instance
    if _instance is None:
        _instance = ClaudeCodeService()
    return _instance
