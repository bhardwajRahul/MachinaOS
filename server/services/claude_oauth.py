"""Claude OAuth — project-local install + plain ``claude login`` spawn.

The Claude Code CLI lives at ``<repo>/data/claude-machina/npm/`` (on-demand
``npm install`` on first use, mirroring the WhatsApp project-local layout)
and ``CLAUDE_CONFIG_DIR`` points at ``<repo>/data/claude-machina/`` so the
credentials file lands inside the project tree, isolated from the user's
own ``~/.claude/`` session.

Login uses the documented subcommand from
https://code.claude.com/docs/en/cli-reference: ``claude auth login`` opens
the browser, ``claude auth logout`` signs out, ``claude auth status``
exits 0 when logged in / 1 otherwise. We spawn ``auth login`` with
inherited stdio so the CLI opens the browser itself (same as the VSCode
Claude Code extension; Anthropic does not expose a programmatic OAuth
helper or a ``--print-url`` flag — see issue
anthropics/claude-code#7100). The background poller in
``services/cli_agent/_handlers.py`` invokes ``claude auth status`` to
flip the catalogue marker on success.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict

from core.logging import get_logger

logger = get_logger(__name__)

# server/services/claude_oauth.py -> parents[2] is the repo root.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]

MACHINA_CLAUDE_DIR = (_PROJECT_ROOT / "data" / "claude-machina").resolve()
MACHINA_NPM_DIR = MACHINA_CLAUDE_DIR / "npm"
CLAUDE_CREDENTIALS_PATH = MACHINA_CLAUDE_DIR / ".credentials.json"


def _get_claude_cmd() -> str:
    """Return path to the project-local claude CLI, installing on miss."""
    if sys.platform == "win32":
        bin_path = MACHINA_NPM_DIR / "node_modules" / ".bin" / "claude.cmd"
    else:
        bin_path = MACHINA_NPM_DIR / "node_modules" / ".bin" / "claude"

    if bin_path.exists():
        return str(bin_path)

    logger.info("Installing Claude Code CLI in project-local environment...")
    MACHINA_NPM_DIR.mkdir(parents=True, exist_ok=True)

    npm_cmd = shutil.which("npm")
    if not npm_cmd:
        raise FileNotFoundError("npm not found on PATH")

    result = subprocess.run(
        [npm_cmd, "install", "@anthropic-ai/claude-code", "--prefix", str(MACHINA_NPM_DIR)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error(f"npm install failed: {result.stderr}")
        raise RuntimeError(f"Failed to install claude-code: {result.stderr}")

    if not bin_path.exists():
        raise FileNotFoundError(f"Claude CLI not found at {bin_path} after install")

    logger.info(f"Claude Code CLI installed at: {bin_path}")
    return str(bin_path)


def _claude_env() -> Dict[str, str]:
    env = os.environ.copy()
    env["CLAUDE_CONFIG_DIR"] = str(MACHINA_CLAUDE_DIR)
    return env


async def initiate_claude_oauth() -> Dict[str, Any]:
    """Spawn ``claude auth login`` and let the CLI open the browser."""
    try:
        MACHINA_CLAUDE_DIR.mkdir(parents=True, exist_ok=True)
        claude_cmd = _get_claude_cmd()

        proc = await asyncio.create_subprocess_exec(
            claude_cmd,
            "auth",
            "login",
            env=_claude_env(),
        )
        logger.info(f"Claude OAuth login started with PID {proc.pid}")

        return {
            "success": True,
            "pid": proc.pid,
            "config_dir": str(MACHINA_CLAUDE_DIR),
            "message": "Claude is opening your browser to authenticate.",
        }
    except FileNotFoundError as e:
        logger.error(f"CLI not found: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.exception(f"Failed to start Claude OAuth: {e}")
        return {"success": False, "error": str(e)}


async def claude_auth_status() -> bool:
    """Return True iff ``claude auth status`` exits 0 (logged in)."""
    try:
        claude_cmd = _get_claude_cmd()
    except (FileNotFoundError, RuntimeError):
        return False

    try:
        proc = await asyncio.create_subprocess_exec(
            claude_cmd,
            "auth",
            "status",
            env=_claude_env(),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return await proc.wait() == 0
    except Exception as e:
        logger.warning(f"claude auth status check failed: {e}")
        return False


async def claude_auth_logout() -> bool:
    """Run ``claude auth logout``. Returns True on exit 0."""
    try:
        claude_cmd = _get_claude_cmd()
    except (FileNotFoundError, RuntimeError):
        return False

    try:
        proc = await asyncio.create_subprocess_exec(
            claude_cmd,
            "auth",
            "logout",
            env=_claude_env(),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return await proc.wait() == 0
    except Exception as e:
        logger.warning(f"claude auth logout failed: {e}")
        return False
