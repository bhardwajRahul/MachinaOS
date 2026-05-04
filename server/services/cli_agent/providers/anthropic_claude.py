"""Anthropic Claude Code CLI provider.

Reference implementation for the `AICliProvider` Protocol. Full feature
set: sessions, resume, budget, turns, allowed_tools, permission_mode,
MCP lockfile, cost-in-JSON.

Subprocess: ``claude --print -p <prompt> --output-format stream-json
--include-partial-messages [--session-id|--resume <UUID>] --model ...
--max-turns ... --max-budget-usd ... --allowedTools ...
--permission-mode ... --append-system-prompt ...``

Auth: native — CLI reads `~/.claude/`. We do NOT inject CLAUDE_CONFIG_DIR.

Final event: ``type == "result"`` carries ``total_cost_usd``,
``duration_ms``, ``num_turns``, ``session_id``, and the assistant's
``result`` string.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.logging import get_logger

from services.cli_agent.config import get_provider_config
from services.cli_agent.protocol import CanonicalUsage
from services.cli_agent.types import ClaudeTaskSpec

logger = get_logger(__name__)

NAME = "claude"


class AnthropicClaudeProvider:
    """`AICliProvider` for Anthropic's Claude Code CLI."""

    def __init__(self) -> None:
        cfg = get_provider_config(NAME)
        if cfg is None:
            raise RuntimeError(
                f"Provider config missing for {NAME!r}. Check ai_cli_providers.json."
            )
        self.name = NAME
        self.package_name = cfg.package_name
        self.binary_name = cfg.binary_name
        self.ide_lock_env_var = cfg.ide_lock_env_var
        self.ide_lockfile_dir = cfg.ide_lockfile_dir
        self._defaults = cfg.defaults
        self._supports = cfg.supports
        self._login_argv = cfg.login_argv
        self._auth_status_argv = cfg.auth_status_argv

    # ---- spawn surface ---------------------------------------------------

    def binary_path(self) -> Path:
        """Resolve the `claude` binary.

        Resolution chain:
          1) `shutil.which("claude")` — system install / npm-global
          2) Fall back to `npx --yes @anthropic-ai/claude-code` shim path

        Raises FileNotFoundError if neither is available.
        """
        which_result = shutil.which(self.binary_name)
        if which_result:
            return Path(which_result)

        npx = shutil.which("npx")
        if npx:
            # Return the npx path — `headless_argv` rebuilds argv with
            # `npx --yes <package>` when the binary isn't on PATH.
            return Path(npx)

        raise FileNotFoundError(
            f"Neither {self.binary_name!r} nor 'npx' found in PATH. "
            f"Install with: npm install -g {self.package_name}"
        )

    def headless_argv(
        self,
        task: Any,  # ClaudeTaskSpec
        *,
        defaults: Dict[str, Any],
    ) -> List[str]:
        """Build the full argv (binary + flags) for one task."""
        if not isinstance(task, ClaudeTaskSpec):
            raise TypeError(
                "AnthropicClaudeProvider.headless_argv requires ClaudeTaskSpec, "
                f"got {type(task).__name__}"
            )

        # Resolve binary — if `claude` isn't on PATH, fall back to npx shim.
        which_claude = shutil.which(self.binary_name)
        if which_claude:
            argv: List[str] = [which_claude]
        else:
            npx = shutil.which("npx")
            if not npx:
                raise FileNotFoundError(
                    f"Neither {self.binary_name!r} nor 'npx' found in PATH"
                )
            argv = [npx, "--yes", self.package_name]

        argv += [
            "-p", task.prompt,
            "--output-format", "stream-json",
            "--include-partial-messages",
            "--verbose",  # required by Claude CLI when using stream-json with --print
        ]

        # Model
        model = (
            task.model
            or defaults.get("default_model")
            or self._defaults.get("default_model", "claude-sonnet-4-6")
        )
        argv += ["--model", model]

        # Session / resume — `resume_session_id` wins if both are set,
        # since "resume" implies the user has a prior session.
        if task.resume_session_id:
            argv += ["--resume", task.resume_session_id]
        elif task.session_id:
            argv += ["--session-id", task.session_id]

        # Max turns
        max_turns = (
            task.max_turns
            if task.max_turns is not None
            else int(defaults.get(
                "default_max_turns",
                self._defaults.get("default_max_turns", 10),
            ))
        )
        argv += ["--max-turns", str(max_turns)]

        # Budget (USD)
        max_budget = (
            task.max_budget_usd
            if task.max_budget_usd is not None
            else float(defaults.get(
                "default_max_budget_usd",
                self._defaults.get("default_max_budget_usd", 5.0),
            ))
        )
        if max_budget > 0:
            argv += ["--max-budget-usd", str(max_budget)]

        # Allowed tools
        allowed = task.allowed_tools or defaults.get(
            "default_allowed_tools",
            self._defaults.get(
                "default_allowed_tools", "Read,Edit,Bash,Glob,Grep,Write"
            ),
        )
        if allowed:
            argv += ["--allowedTools", allowed]

        # Permission mode (default acceptEdits)
        perm = task.permission_mode or defaults.get(
            "default_permission_mode",
            self._defaults.get("default_permission_mode", "acceptEdits"),
        )
        if perm:
            argv += ["--permission-mode", perm]

        # System prompt — appended to Claude Code's built-in system prompt
        if task.system_prompt:
            argv += ["--append-system-prompt", task.system_prompt]

        return argv

    # ---- native auth -----------------------------------------------------

    def login_argv(self) -> List[str]:
        return list(self._login_argv) or ["claude", "login"]

    def auth_status_argv(self) -> Optional[List[str]]:
        return list(self._auth_status_argv) if self._auth_status_argv else None

    def detect_auth_error(self, stderr: str, exit_code: int) -> bool:
        """True if stderr/exit_code indicate the user isn't logged in."""
        if not stderr and exit_code == 0:
            return False
        markers = (
            "Please run 'claude login'",
            "Please run `claude login`",
            "Not authenticated",
            "Authentication required",
            "401 Unauthorized",
            "Invalid API key",
        )
        return any(m in stderr for m in markers)

    # ---- streaming output parsing ---------------------------------------

    def parse_event(self, line: str) -> Optional[Dict[str, Any]]:
        line = line.strip()
        if not line:
            return None
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            return None

    def is_final_event(self, event: Dict[str, Any]) -> bool:
        return event.get("type") == "result"

    def event_to_session_result(
        self,
        events: List[Dict[str, Any]],
        stderr: str,
        exit_code: int,
    ) -> Dict[str, Any]:
        """Reconstruct shared result fields from the event stream."""
        final = next(
            (e for e in reversed(events) if e.get("type") == "result"),
            None,
        )

        # Session ID can come from `system.init` or `result`
        session_id: Optional[str] = None
        for evt in events:
            sid = evt.get("session_id")
            if sid:
                session_id = sid
                break

        tool_calls = sum(
            1 for evt in events
            if evt.get("type") == "tool_use"
            or (evt.get("type") == "assistant" and self._has_tool_use(evt))
        )

        provider_data: Dict[str, Any] = {}
        for evt in events:
            if evt.get("type") == "assistant":
                msg = evt.get("message") or {}
                rd = msg.get("reasoning_details") or msg.get("thinking")
                if rd is not None:
                    provider_data.setdefault("reasoning_details", rd)
                    break

        success = exit_code == 0 and final is not None
        error: Optional[str] = None
        if exit_code != 0:
            error = stderr.strip()[-2000:] or f"claude exited with code {exit_code}"
        elif final is None:
            error = "no result event received"

        response = ""
        cost: Optional[float] = None
        duration_ms: Optional[int] = None
        num_turns: Optional[int] = None
        if final:
            response = str(final.get("result") or "")
            cost = final.get("total_cost_usd")
            duration_ms = final.get("duration_ms")
            num_turns = final.get("num_turns")
            if final.get("subtype") == "error":
                success = False
                error = error or response or "result event reports error"

        cu = self.canonical_usage(events)

        return {
            "session_id": session_id,
            "response": response,
            "cost_usd": cost,
            "duration_ms": duration_ms,
            "num_turns": num_turns,
            "tool_calls": tool_calls,
            "canonical_usage": cu,
            "provider_data": provider_data,
            "success": success,
            "error": error,
        }

    def canonical_usage(self, events: List[Dict[str, Any]]) -> CanonicalUsage:
        """Pull token counts from the `result` event's `usage` block.

        Anthropic shape:
          {
            "input_tokens": int,
            "output_tokens": int,
            "cache_creation_input_tokens": int,
            "cache_read_input_tokens": int,
          }
        """
        final = next(
            (e for e in reversed(events) if e.get("type") == "result"),
            None,
        )
        if not final:
            return CanonicalUsage()

        usage = final.get("usage") or {}
        request_count = (
            int(final.get("num_turns") or 0)
            or sum(1 for e in events if e.get("type") == "assistant")
        )
        return CanonicalUsage(
            input_tokens=int(usage.get("input_tokens", 0)),
            output_tokens=int(usage.get("output_tokens", 0)),
            cache_read=int(usage.get("cache_read_input_tokens", 0)),
            cache_write=int(usage.get("cache_creation_input_tokens", 0)),
            reasoning_tokens=0,  # Claude doesn't expose this separately
            request_count=request_count,
        )

    # ---- feature gating --------------------------------------------------

    def supports(self, feature: str) -> bool:
        return feature in self._supports

    # ---- internals -------------------------------------------------------

    @staticmethod
    def _has_tool_use(event: Dict[str, Any]) -> bool:
        msg = event.get("message") or {}
        content = msg.get("content")
        if isinstance(content, list):
            return any(
                isinstance(blk, dict) and blk.get("type") == "tool_use"
                for blk in content
            )
        return False
