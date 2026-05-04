"""Native CLI auth — login + status, no token wrapping.

Replaces what would have been per-provider OAuth modules
(``codex_oauth.py``, ``gemini_oauth.py``). Each CLI ships a working
``<provider> login`` flow that handles the browser/device flow and
stores credentials in its native location (``~/.claude/``,
``~/.codex/``, ``~/.gemini/``). MachinaOs only triggers the flow and
detects the resulting state.

Two public coroutines:

- :func:`run_native_login` — spawns ``<provider> login`` (interactive
  by default; the user completes the browser/device flow directly).
- :func:`check_auth` — runs ``<provider> --version`` (or whatever
  ``auth_status_argv()`` returns), feeds output into
  ``provider.detect_auth_error()``, returns a ``{logged_in, available,
  hint, ...}`` payload for the Credentials Modal.

Both share a single ``_resolve_argv`` helper that does the npx-shim
fallback the providers' own ``binary_path()`` does.
"""

from __future__ import annotations

import asyncio
import shutil
from typing import Any, Dict, List, Optional, Tuple

from core.logging import get_logger

from services.cli_agent.factory import create_cli_provider
from services.cli_agent.protocol import AICliProvider

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Shared argv resolution (binary or npx fallback)
# ---------------------------------------------------------------------------

def _resolve_argv(
    provider: AICliProvider,
    argv: List[str],
) -> Tuple[Optional[List[str]], Optional[str]]:
    """Resolve ``argv[0]`` to an absolute path or an npx shim.

    Returns ``(resolved_argv, error)``. Either field is None.
    """
    if not argv:
        return None, "empty argv"
    resolved = shutil.which(argv[0])
    if resolved:
        return [resolved] + argv[1:], None
    npx = shutil.which("npx")
    if npx and provider.package_name:
        return [npx, "--yes", provider.package_name] + argv[1:], None
    return None, (
        f"Command not found: {argv[0]!r}. Install with "
        f"`npm install -g {provider.package_name}` or ensure 'npx' is on PATH."
    )


def _build_provider(provider_name: str) -> Tuple[Optional[AICliProvider], Optional[Dict[str, Any]]]:
    """Construct a provider, mapping factory errors to result dicts."""
    try:
        return create_cli_provider(provider_name), None
    except NotImplementedError as exc:
        return None, {
            "success": False, "logged_in": False, "available": False,
            "exit_code": None, "stderr_tail": "",
            "hint": "Provider deferred to v2",
            "error": str(exc),
        }
    except ValueError as exc:
        return None, {
            "success": False, "logged_in": False, "available": False,
            "exit_code": None, "stderr_tail": "",
            "hint": "Unknown provider",
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

async def run_native_login(
    provider_name: str,
    *,
    timeout_seconds: float = 300.0,
    inherit_stdio: bool = True,
) -> Dict[str, Any]:
    """Spawn the CLI's own ``<provider> login`` command.

    With ``inherit_stdio=True`` (default) the user completes the OAuth /
    device-code flow directly in their terminal — we capture nothing.
    """
    provider, err = _build_provider(provider_name)
    if err is not None:
        return err
    assert provider is not None

    argv, resolve_err = _resolve_argv(provider, list(provider.login_argv()))
    if argv is None:
        return {
            "success": False, "exit_code": None, "stderr_tail": "",
            "error": resolve_err,
        }

    logger.info("[cli_login:%s] spawning %s", provider_name, argv)

    if inherit_stdio:
        proc = await asyncio.create_subprocess_exec(*argv)
        try:
            exit_code = await asyncio.wait_for(proc.wait(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            proc.kill()
            return {
                "success": False, "exit_code": None, "stderr_tail": "",
                "error": f"login timed out after {timeout_seconds:.0f}s",
            }
        return {
            "success": exit_code == 0,
            "exit_code": exit_code,
            "stderr_tail": "",
            "error": None if exit_code == 0 else f"login exited with code {exit_code}",
        }

    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        proc.kill()
        return {
            "success": False, "exit_code": None, "stderr_tail": "",
            "error": f"login timed out after {timeout_seconds:.0f}s",
        }
    stderr_text = stderr.decode("utf-8", errors="replace")
    return {
        "success": proc.returncode == 0,
        "exit_code": proc.returncode,
        "stderr_tail": stderr_text[-2000:],
        "error": (
            None if proc.returncode == 0
            else f"login exited with code {proc.returncode}"
        ),
    }


# ---------------------------------------------------------------------------
# Auth status
# ---------------------------------------------------------------------------

async def check_auth(
    provider_name: str,
    *,
    timeout_seconds: float = 15.0,
) -> Dict[str, Any]:
    """Probe whether ``provider_name`` is logged in.

    ``available`` is False when the binary isn't installed.
    """
    provider, err = _build_provider(provider_name)
    if err is not None:
        return err
    assert provider is not None

    status_argv = provider.auth_status_argv()
    if not status_argv:
        # No cheap probe configured — defer to the first session's stderr.
        return {
            "logged_in": True,  # optimistic; real run will surface errors
            "available": True,
            "hint": "",
            "exit_code": None,
            "error": None,
        }

    argv, resolve_err = _resolve_argv(provider, list(status_argv))
    if argv is None:
        return {
            "logged_in": False, "available": False,
            "hint": (
                f"Install the CLI: `npm install -g {provider.package_name}`"
                if provider.package_name
                else f"Install the {provider_name} CLI"
            ),
            "exit_code": None,
            "error": resolve_err,
        }

    logger.debug("[cli_auth_status:%s] probing %s", provider_name, argv)

    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        return {
            "logged_in": False, "available": True,
            "hint": "auth status probe timed out",
            "exit_code": None,
            "error": f"timeout after {timeout_seconds:.0f}s",
        }
    except FileNotFoundError as exc:
        return {
            "logged_in": False, "available": False,
            "hint": f"Install the {provider_name} CLI",
            "exit_code": None,
            "error": str(exc),
        }

    stderr_text = stderr.decode("utf-8", errors="replace")
    stdout_text = stdout.decode("utf-8", errors="replace")
    combined = f"{stderr_text}\n{stdout_text}"
    exit_code = proc.returncode if proc.returncode is not None else -1

    if provider.detect_auth_error(combined, exit_code):
        login_hint = " ".join(provider.login_argv())
        return {
            "logged_in": False, "available": True,
            "hint": f"Run `{login_hint}` (or click Login in the Credentials Modal)",
            "exit_code": exit_code,
            "error": stderr_text[-500:].strip() or "not authenticated",
        }

    if exit_code != 0:
        # Non-zero exit but not an auth error.
        return {
            "logged_in": False, "available": True,
            "hint": f"Status probe failed (exit {exit_code})",
            "exit_code": exit_code,
            "error": stderr_text[-500:].strip() or "non-zero exit",
        }

    return {
        "logged_in": True, "available": True,
        "hint": "",
        "exit_code": 0,
        "error": None,
    }
