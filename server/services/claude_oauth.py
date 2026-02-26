"""Claude OAuth Service - Isolated login that doesn't affect user's main session."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any

from core.logging import get_logger

logger = get_logger(__name__)

# Isolated directories for MachinaOs
MACHINA_CLAUDE_DIR = Path.home() / ".claude-machina"
MACHINA_NPM_DIR = MACHINA_CLAUDE_DIR / "npm"


def _get_claude_cmd() -> str:
    """Get path to isolated claude CLI, installing if needed."""
    if sys.platform == "win32":
        claude_path = MACHINA_NPM_DIR / "claude.cmd"
    else:
        claude_path = MACHINA_NPM_DIR / "bin" / "claude"

    if claude_path.exists():
        return str(claude_path)

    # Install claude-code in isolated location
    logger.info("Installing Claude Code CLI in isolated environment...")
    MACHINA_NPM_DIR.mkdir(parents=True, exist_ok=True)

    npm_cmd = shutil.which("npm")
    if not npm_cmd:
        raise FileNotFoundError("npm not found")

    result = subprocess.run(
        [npm_cmd, "install", "@anthropic-ai/claude-code", "--prefix", str(MACHINA_NPM_DIR)],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(f"npm install failed: {result.stderr}")
        raise RuntimeError(f"Failed to install claude-code: {result.stderr}")

    # Find the installed binary
    if sys.platform == "win32":
        claude_path = MACHINA_NPM_DIR / "node_modules" / ".bin" / "claude.cmd"
    else:
        claude_path = MACHINA_NPM_DIR / "node_modules" / ".bin" / "claude"

    if not claude_path.exists():
        raise FileNotFoundError(f"Claude CLI not found at {claude_path} after install")

    logger.info(f"Claude Code CLI installed at: {claude_path}")
    return str(claude_path)


async def initiate_claude_oauth() -> Dict[str, Any]:
    """Run claude login in isolated environment with auto-filled prompts."""
    try:
        MACHINA_CLAUDE_DIR.mkdir(exist_ok=True)

        # Get or install claude CLI
        claude_cmd = _get_claude_cmd()

        env = os.environ.copy()
        env["CLAUDE_CONFIG_DIR"] = str(MACHINA_CLAUDE_DIR)

        # Run claude login with stdin to auto-fill prompts
        # Claude login asks: 1) "Do you agree?" (yes) 2) "Open browser?" (yes)
        if sys.platform == "win32":
            # Windows: pipe inputs and let it open browser
            process = subprocess.Popen(
                [claude_cmd, "login"],
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            # Send "yes" responses for the prompts
            try:
                process.stdin.write(b"yes\nyes\n")
                process.stdin.flush()
            except Exception:
                pass
        else:
            # Unix: pipe inputs
            process = subprocess.Popen(
                [claude_cmd, "login"],
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                process.stdin.write(b"yes\nyes\n")
                process.stdin.flush()
            except Exception:
                pass

        logger.info(f"Claude OAuth login started with PID {process.pid}")

        return {
            "success": True,
            "message": "OAuth login started. Browser should open for authentication.",
            "config_dir": str(MACHINA_CLAUDE_DIR),
            "pid": process.pid,
        }
    except FileNotFoundError as e:
        logger.error(f"CLI not found: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"Failed to start Claude OAuth: {e}")
        return {"success": False, "error": str(e)}


def get_claude_credentials() -> Dict[str, Any]:
    """Read credentials from isolated config."""
    try:
        creds_path = MACHINA_CLAUDE_DIR / ".credentials.json"
        if not creds_path.exists():
            return {"success": False, "has_token": False}

        with open(creds_path) as f:
            creds = json.load(f)

        return {
            "success": True,
            "has_token": bool(creds.get("accessToken")),
            "access_token": creds.get("accessToken"),
            "expires_at": creds.get("expiresAt"),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
