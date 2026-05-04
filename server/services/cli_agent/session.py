"""One CLI session per task — `BaseProcessSupervisor` subclass.

Each session is bound to:
  - one provider (Claude or Codex)
  - one task spec (`ClaudeTaskSpec` / `CodexTaskSpec`)
  - one git worktree (created in `_pre_spawn`, removed in `cleanup`)
  - one IDE lockfile (written in `_pre_spawn` when the provider supports it)

Inherits `BaseProcessSupervisor`'s locked idempotent start/stop, recursive
`kill_tree`, `terminate_then_kill(5s)` grace, and Windows
`CTRL_BREAK_EVENT` path. We override `_do_start` to wire NDJSON consumers
instead of the parent's generic `drain_stream(logger.info)`.

Sessions are NOT registered in the global supervisor registry — they're
owned by `AICliService.run_batch()` for the lifetime of one batch.

Liveness: relies on `wait_for_completion(timeout_seconds)` as the watchdog
and the per-broadcast Temporal heartbeat fired by every
`update_node_status()` call. We do not run our own per-second heartbeat
loop or write diagnostic dump files.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import anyio

from core.logging import get_logger
from services._supervisor.process import BaseProcessSupervisor
from services.cli_agent.lockfile import remove_ide_lockfile, write_ide_lockfile
from services.cli_agent.protocol import AICliProvider, CanonicalUsage, SessionResult
from services.cli_agent.types import BaseAICliTaskSpec

logger = get_logger(__name__)


class AICliSession(BaseProcessSupervisor):
    """One CLI subprocess for one task."""

    pipe_streams = True
    terminate_grace_seconds = 5.0
    graceful_shutdown = sys.platform == "win32"

    def __init__(
        self,
        *,
        provider: AICliProvider,
        task: BaseAICliTaskSpec,
        repo_root: Path,
        workspace_dir: Path,
        node_id: str,
        workflow_id: str,
        broadcaster: Any,
        defaults: Dict[str, Any],
        mcp_port: int,
        batch_token: str,
    ) -> None:
        super().__init__()
        self._provider = provider
        self._task = task
        self._task_id = task.task_id or f"t_{uuid.uuid4().hex[:8]}"
        self._repo_root = Path(repo_root).resolve()
        self._worktree_dir = (
            Path(workspace_dir).resolve() / node_id / f"wt_{self._task_id}"
        )
        self._branch = task.branch or f"machina/{self._task_id}"
        self._broadcaster = broadcaster
        self._defaults = defaults
        self._mcp_port = mcp_port
        self._batch_token = batch_token
        self._node_id = node_id
        self._workflow_id = workflow_id

        # Streaming state
        self._events: List[Dict[str, Any]] = []
        self._stderr_lines: List[str] = []
        self._exit_code: Optional[int] = None
        self._lockfile_path: Optional[Path] = None

    # ------------------------------------------------------------------
    # Identity
    # ------------------------------------------------------------------

    @property
    def label(self) -> str:
        return f"AICliSession_{self._provider.name}_{self._task_id}"

    @property
    def task_id(self) -> str:
        return self._task_id

    @property
    def branch(self) -> str:
        return self._branch

    @property
    def worktree_dir(self) -> Path:
        return self._worktree_dir

    # ------------------------------------------------------------------
    # BaseProcessSupervisor surface
    # ------------------------------------------------------------------

    def binary_path(self) -> Path:
        return self._provider.binary_path()

    def argv(self) -> List[str]:
        return self._provider.headless_argv(self._task, defaults=self._defaults)

    def cwd(self) -> Optional[Path]:
        return self._worktree_dir

    def env(self) -> Dict[str, str]:
        # Inherit parent env so the CLI finds its own auth in
        # `~/.claude/`, `~/.codex/`, `~/.gemini/`. Native CLI auth model:
        # we never inject CLAUDE_CONFIG_DIR / GEMINI_CLI_HOME.
        e: Dict[str, str] = {**os.environ, "PYTHONUNBUFFERED": "1"}
        if self._lockfile_path and self._provider.ide_lock_env_var:
            e[self._provider.ide_lock_env_var] = str(self._lockfile_path)
        # Composio-style parent-run-ID for MCP correlation
        e["MACHINA_PARENT_RUN_ID"] = (
            f"{self._workflow_id}:{self._node_id}:{self._batch_token[:8]}"
        )
        return e

    async def _pre_spawn(self) -> None:
        """Create the per-task git worktree and (if supported) write the
        IDE lockfile. Failures abort `_do_start` cleanly via RuntimeError."""
        # 1. git worktree
        self._worktree_dir.parent.mkdir(parents=True, exist_ok=True)
        wt_proc = await anyio.run_process(
            [
                "git", "-C", str(self._repo_root),
                "worktree", "add",
                str(self._worktree_dir),
                "-b", self._branch,
            ],
            check=False,
        )
        if wt_proc.returncode != 0:
            err = (wt_proc.stderr or b"").decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"git worktree add failed: {err}")

        # 2. IDE lockfile (VSCode pattern) — providers that support it
        if self._provider.supports("ide_lockfile") and self._provider.ide_lockfile_dir:
            try:
                self._lockfile_path = write_ide_lockfile(
                    ide_lockfile_dir=self._provider.ide_lockfile_dir,
                    pid=os.getpid(),
                    port=self._mcp_port,
                    token=self._batch_token,
                    workspace_dir=self._worktree_dir,
                    ide_name=self._provider.name,
                )
            except OSError as exc:
                logger.warning(
                    "[%s] IDE lockfile write failed (%s) — continuing without MCP tools",
                    self.label, exc,
                )

    # ------------------------------------------------------------------
    # _do_start: replace parent's drain tasks with NDJSON consumers
    # ------------------------------------------------------------------

    async def _do_start(self) -> None:
        binary = self.binary_path()
        if not binary.exists():
            raise FileNotFoundError(f"{self.label} binary not found at {binary}")

        await self._pre_spawn()

        kwargs: Dict[str, Any] = {
            "cwd": str(self.cwd()),
            "env": self.env(),
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
        }
        if sys.platform == "win32" and self.graceful_shutdown:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]

        self._proc = await anyio.open_process(self.argv(), **kwargs)
        self._logger.info(
            "[%s] spawned pid=%s task=%s branch=%s",
            self.label, self._proc.pid, self._task_id, self._branch,
        )

        # NDJSON consumers replace the parent's `drain_stream(logger.info)`.
        # We populate `self._drain_tasks` so the parent's `_do_stop`
        # cancels them on stop.
        self._drain_tasks = [
            asyncio.create_task(self._consume_stdout(self._proc.stdout)),
            asyncio.create_task(self._consume_stderr(self._proc.stderr)),
        ]

    # ------------------------------------------------------------------
    # Stream consumers
    # ------------------------------------------------------------------

    async def _consume_stdout(self, stream: Optional[anyio.abc.ByteReceiveStream]) -> None:
        if stream is None:
            return
        buf = b""
        try:
            async for chunk in stream:
                buf += chunk
                while b"\n" in buf:
                    raw, buf = buf.split(b"\n", 1)
                    text = raw.decode("utf-8", errors="replace").strip()
                    if not text:
                        continue
                    event = self._provider.parse_event(text)
                    if event is None:
                        continue
                    self._events.append(event)
                    await self._on_event(event)
            if buf:
                text = buf.decode("utf-8", errors="replace").strip()
                if text:
                    event = self._provider.parse_event(text)
                    if event is not None:
                        self._events.append(event)
                        await self._on_event(event)
        except (anyio.ClosedResourceError, anyio.EndOfStream, asyncio.CancelledError):
            pass
        except Exception as exc:  # pragma: no cover — defensive
            self._logger.debug("[%s] stdout consumer ended: %s", self.label, exc)

    async def _consume_stderr(self, stream: Optional[anyio.abc.ByteReceiveStream]) -> None:
        if stream is None:
            return
        buf = b""
        try:
            async for chunk in stream:
                buf += chunk
                while b"\n" in buf:
                    raw, buf = buf.split(b"\n", 1)
                    text = raw.decode("utf-8", errors="replace").rstrip()
                    if not text:
                        continue
                    self._stderr_lines.append(text)
                    await self._safe_terminal_log(text, level="error")
            if buf:
                text = buf.decode("utf-8", errors="replace").rstrip()
                if text:
                    self._stderr_lines.append(text)
                    await self._safe_terminal_log(text, level="error")
        except (anyio.ClosedResourceError, anyio.EndOfStream, asyncio.CancelledError):
            pass
        except Exception as exc:  # pragma: no cover
            self._logger.debug("[%s] stderr consumer ended: %s", self.label, exc)

    # ------------------------------------------------------------------
    # Event dispatch (UI broadcasts)
    # ------------------------------------------------------------------

    async def _on_event(self, event: Dict[str, Any]) -> None:
        if self._provider.is_final_event(event):
            payload = {
                "phase": "ai_cli_subtask",
                "task_id": self._task_id,
                "provider": self._provider.name,
                "status": "finalising",
            }
            for k in ("total_cost_usd", "duration_ms", "num_turns", "session_id"):
                v = event.get(k)
                if v is not None:
                    payload[k] = v
            await self._safe_node_status("executing", payload)
        else:
            msg = (
                event.get("message")
                or event.get("text")
                or event.get("delta")
                or json.dumps(event)
            )
            text = msg if isinstance(msg, str) else json.dumps(msg)
            await self._safe_terminal_log(text[:500], level="info")

    async def _safe_terminal_log(self, message: str, *, level: str) -> None:
        if not self._broadcaster:
            return
        try:
            await self._broadcaster.broadcast_terminal_log({
                "source": f"{self._provider.name}:{self._task_id}",
                "level": level,
                "message": message,
            })
        except Exception:
            pass

    async def _safe_node_status(self, status: str, data: Dict[str, Any]) -> None:
        if not self._broadcaster:
            return
        try:
            await self._broadcaster.update_node_status(
                self._node_id, status, data,
                workflow_id=self._workflow_id,
            )
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Public lifecycle
    # ------------------------------------------------------------------

    async def wait_for_completion(self, timeout_seconds: int) -> SessionResult:
        """Wait for the CLI to exit, with hard timeout watchdog."""
        if self._proc is None:
            return self._build_result(
                success=False, error="session never started",
            )

        try:
            await asyncio.wait_for(self._proc.wait(), timeout=timeout_seconds)
            self._exit_code = self._proc.returncode
            return self._build_result(success=(self._exit_code == 0))
        except asyncio.TimeoutError:
            await self.stop()
            return self._build_result(
                success=False,
                error=f"timeout after {timeout_seconds}s",
            )

    async def cleanup(self) -> None:
        """Stop the process and remove the worktree + lockfile."""
        try:
            await self.stop()
        except Exception as exc:
            self._logger.debug("[%s] stop during cleanup: %s", self.label, exc)

        if self._lockfile_path:
            remove_ide_lockfile(self._lockfile_path)
            self._lockfile_path = None

        # Remove the worktree (force, since branch lifecycle is the
        # batch's responsibility — best-effort).
        try:
            await anyio.run_process(
                [
                    "git", "-C", str(self._repo_root),
                    "worktree", "remove", "--force",
                    str(self._worktree_dir),
                ],
                check=False,
            )
        except Exception as exc:
            self._logger.debug("[%s] worktree remove: %s", self.label, exc)

    # ------------------------------------------------------------------
    # Result construction
    # ------------------------------------------------------------------

    def _build_result(
        self,
        *,
        success: bool,
        error: Optional[str] = None,
    ) -> SessionResult:
        provider_result = self._provider.event_to_session_result(
            self._events,
            "\n".join(self._stderr_lines),
            self._exit_code if self._exit_code is not None else -1,
        )

        canonical = provider_result.get("canonical_usage")
        if not isinstance(canonical, CanonicalUsage):
            canonical = self._provider.canonical_usage(self._events)

        final_success = success and provider_result.get("success", True)
        final_error = error or provider_result.get("error")

        return SessionResult(
            task_id=self._task_id,
            session_id=provider_result.get("session_id"),
            provider=self._provider.name,
            prompt=self._task.prompt,
            branch=self._branch,
            worktree_path=str(self._worktree_dir),
            response=str(provider_result.get("response") or "")[:4000],
            cost_usd=provider_result.get("cost_usd"),
            duration_ms=provider_result.get("duration_ms"),
            num_turns=provider_result.get("num_turns"),
            tool_calls=int(provider_result.get("tool_calls", 0)),
            canonical_usage=canonical,
            provider_data=dict(provider_result.get("provider_data") or {}),
            success=final_success,
            error=final_error if not final_success else None,
        )
