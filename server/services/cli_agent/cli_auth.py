"""Native CLI login spawner.

Replaces what would have been per-provider OAuth modules
(``codex_oauth.py``, ``gemini_oauth.py``). Each CLI ships a working
``<provider> login`` flow that handles the browser/device flow and
stores credentials in its native location (``~/.claude/``,
``~/.codex/``, ``~/.gemini/``). MachinaOs only triggers the flow.

After ``run_native_login()`` succeeds, ``_handlers.py`` writes a
synthetic marker OAuth token via ``auth_service.store_oauth_tokens()``
(Stripe-style — see ``nodes/stripe/_handlers.py``). The catalogue's
generic ``stored`` check then flips ``true`` and the existing
``OAuthConnect.tsx`` primitive renders the modal as Connected — no
per-provider status hook needed.

There's no ``check_auth`` here: the marker-token + catalogue-broadcast
pattern makes a separate status probe redundant. If you actually want to
verify the CLI is functional (vs just "we marked you as logged in"), the
first session attempt's stderr matcher (``provider.detect_auth_error``)
catches it.
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
# Argv resolution (shared between login + the providers' own binary_path)
# ---------------------------------------------------------------------------

def _resolve_argv(
    provider: AICliProvider,
    argv: List[str],
) -> Tuple[Optional[List[str]], Optional[str]]:
    """Resolve ``argv[0]`` to an absolute path or an npx shim.

    Returns ``(resolved_argv, error)``. Either field is None.

    NB: For npm-distributed CLIs (Claude / Codex / Gemini), the Stripe
    GitHub-release auto-installer pattern doesn't apply — there are no
    standalone binaries on GitHub releases. We fall back to ``npx`` which
    auto-fetches the npm package on first use, mirroring what
    ``provider.binary_path()`` already does in the providers themselves.
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
        return None, {"success": False, "exit_code": None, "stderr_tail": "", "error": str(exc)}
    except ValueError as exc:
        return None, {"success": False, "exit_code": None, "stderr_tail": "", "error": str(exc)}


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
