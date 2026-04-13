"""Cross-platform process manager for long-running subprocesses.

Manages lifecycle (start/stop/restart), streams stdout/stderr to the
Terminal tab via broadcast_terminal_log(), and persists output to temp
log files so AI agents can fetch output selectively.

Uses stdlib asyncio.create_subprocess_exec -- no third-party deps beyond
psutil (already a project dependency for process tree killing).
"""

import asyncio
import os
import shlex
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import psutil

from core.logging import get_logger

logger = get_logger(__name__)

MAX_PROCESSES = 10  # Default limit, configurable via Settings panel


@dataclass
class ManagedProcess:
    name: str
    command: str
    argv: List[str]
    pid: int
    status: str  # running, stopped, error
    started_at: str
    workflow_id: str
    working_directory: str
    process: asyncio.subprocess.Process
    log_dir: Path  # temp directory for stdout.log / stderr.log
    stdout_task: Optional[asyncio.Task] = None
    stderr_task: Optional[asyncio.Task] = None
    exit_code: Optional[int] = None
    stdout_lines: int = 0
    stderr_lines: int = 0


class ProcessService:
    """Singleton managing long-running subprocesses per workflow.

    Output is written to temp files at {tmp}/machina-proc-{name}/stdout.log
    and stderr.log. AI agents read them via get_output() with tail/offset.
    Files are cleaned up on stop or shutdown.
    """

    def __init__(self) -> None:
        self._processes: Dict[tuple, ManagedProcess] = {}
        self._broadcaster = None
        self.max_processes: int = MAX_PROCESSES

    def set_broadcaster(self, broadcaster) -> None:
        self._broadcaster = broadcaster

    def _key(self, workflow_id: str, name: str) -> tuple:
        return (workflow_id, name)

    async def start(
        self,
        name: str,
        command: str,
        workflow_id: str = "default",
        working_directory: str = "",
    ) -> Dict[str, Any]:
        """Start a long-running process."""
        if not command:
            return {"success": False, "error": "command is required"}

        # Block destructive commands -- file ops should use the sandboxed shell node
        cmd_lower = command.lower().strip()
        blocked = (
            "rm ", "rm\t", "rmdir", "del ", "rd ", "remove-item",
            "format ", "mkfs", "dd if=", "shred",
            "> /dev/", "chmod 777", "chmod -r",
        )
        if any(cmd_lower.startswith(b) or f" {b}" in f" {cmd_lower}" for b in blocked):
            return {
                "success": False,
                "error": f"Destructive commands blocked in process_manager. "
                         f"Use shell_execute for file operations (sandboxed, no PATH).",
            }

        name = name or f"proc_{id(command) % 100000}"
        key = self._key(workflow_id, name)

        # Check process limit (exclude stopped/error -- only count running)
        running = sum(1 for m in self._processes.values() if m.status == "running")
        if key not in self._processes and running >= self.max_processes:
            return {"success": False, "error": f"Process limit reached ({self.max_processes}). Stop a process first."}

        # Stop existing process with same name
        if key in self._processes and self._processes[key].status == "running":
            await self.stop(name, workflow_id)

        argv = shlex.split(command)
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        from core.config import Settings
        workspace_base = Path(Settings().workspace_base_dir).resolve()

        if not working_directory:
            working_directory = str(workspace_base / 'default')
            os.makedirs(working_directory, exist_ok=True)
        cwd = working_directory

        # Guardrail: cwd must resolve inside workspace base
        if not Path(cwd).resolve().is_relative_to(workspace_base):
            return {
                "success": False,
                "error": f"Working directory must be inside workspace ({workspace_base}).",
            }

        # Create log directory inside the workflow workspace
        # Layout: {workspace}/.processes/{name}/stdout.log, stderr.log
        log_dir = Path(cwd) / ".processes" / name
        log_dir.mkdir(parents=True, exist_ok=True)
        # Clear old logs if restarting
        for f in ("stdout.log", "stderr.log"):
            (log_dir / f).write_text("")

        logger.info("[Process] Starting: %s (name=%s, cwd=%s, logs=%s)", command[:200], name, cwd, log_dir)

        try:
            proc = await asyncio.create_subprocess_exec(
                *argv,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
                env=env,
            )
        except Exception as e:
            logger.error("[Process] Failed to start: %s -> %s", command[:100], e)
            return {"success": False, "error": str(e)}

        managed = ManagedProcess(
            name=name,
            command=command,
            argv=argv,
            pid=proc.pid,
            status="running",
            started_at=datetime.now().isoformat(),
            workflow_id=workflow_id,
            working_directory=cwd,
            process=proc,
            log_dir=log_dir,
        )

        managed.stdout_task = asyncio.create_task(
            self._read_stream(managed, proc.stdout, "stdout"),
            name=f"proc-stdout-{name}",
        )
        managed.stderr_task = asyncio.create_task(
            self._read_stream(managed, proc.stderr, "stderr"),
            name=f"proc-stderr-{name}",
        )

        self._processes[key] = managed

        logger.info("[Process] Started: %s (pid=%d)", name, proc.pid)
        return {"success": True, "result": self._info(managed)}

    async def stop(self, name: str, workflow_id: str = "default") -> Dict[str, Any]:
        """Stop a running process by killing its process tree."""
        key = self._key(workflow_id, name)
        managed = self._processes.get(key)
        if not managed:
            return {"success": False, "error": f"Process '{name}' not found"}

        if managed.status != "running":
            return {"success": True, "result": self._info(managed)}

        logger.info("[Process] Stopping: %s (pid=%d)", name, managed.pid)
        _kill_process_tree(managed.pid)
        managed.status = "stopped"

        for task in (managed.stdout_task, managed.stderr_task):
            if task and not task.done():
                task.cancel()

        try:
            managed.exit_code = await asyncio.wait_for(managed.process.wait(), timeout=3)
        except asyncio.TimeoutError:
            managed.exit_code = -1

        logger.info("[Process] Stopped: %s (exit=%s)", name, managed.exit_code)
        return {"success": True, "result": self._info(managed)}

    async def restart(self, name: str, workflow_id: str = "default") -> Dict[str, Any]:
        """Restart a process with the same command."""
        key = self._key(workflow_id, name)
        managed = self._processes.get(key)
        if not managed:
            return {"success": False, "error": f"Process '{name}' not found"}

        command = managed.command
        cwd = managed.working_directory
        await self.stop(name, workflow_id)
        return await self.start(name, command, workflow_id, cwd)

    async def send_input(self, name: str, workflow_id: str, text: str) -> Dict[str, Any]:
        """Write text to a process's stdin."""
        key = self._key(workflow_id, name)
        managed = self._processes.get(key)
        if not managed:
            return {"success": False, "error": f"Process '{name}' not found"}
        if managed.status != "running":
            return {"success": False, "error": f"Process '{name}' is {managed.status}"}

        stdin = managed.process.stdin
        if not stdin:
            return {"success": False, "error": "Process has no stdin"}

        data = text if text.endswith("\n") else text + "\n"
        stdin.write(data.encode())
        await stdin.drain()

        logger.info("[Process] Sent input to %s: %s", name, text[:100])
        return {"success": True, "result": {"sent": text}}

    def list_processes(self, workflow_id: str = "default") -> List[Dict[str, Any]]:
        """List all processes for a workflow."""
        return [
            self._info(m)
            for (wid, _), m in self._processes.items()
            if wid == workflow_id
        ]

    def get_output(
        self,
        name: str,
        workflow_id: str = "default",
        stream: str = "stdout",
        tail: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Read output from a process's log file.

        Args:
            stream: 'stdout' or 'stderr'
            tail: Number of lines from the end (0 = all lines)
            offset: Skip first N lines (only when tail=0)
        """
        key = self._key(workflow_id, name)
        managed = self._processes.get(key)
        if not managed:
            return {"lines": [], "total": 0, "file": ""}

        log_file = managed.log_dir / f"{stream}.log"
        if not log_file.exists():
            return {"lines": [], "total": 0, "file": str(log_file)}

        all_lines = log_file.read_text(errors="replace").splitlines()
        total = len(all_lines)

        if tail > 0:
            lines = all_lines[-tail:]
        else:
            lines = all_lines[offset:]

        return {"lines": lines, "total": total, "file": str(log_file)}

    def cleanup_logs(self, name: str, workflow_id: str = "default") -> None:
        """Remove log files for a process."""
        key = self._key(workflow_id, name)
        managed = self._processes.get(key)
        if managed and managed.log_dir.exists():
            shutil.rmtree(managed.log_dir, ignore_errors=True)
            logger.info("[Process] Cleaned logs: %s", managed.log_dir)

    async def shutdown(self) -> None:
        """Kill all managed processes and clean up log files."""
        if not self._processes:
            return
        logger.info("[Process] Shutting down %d process(es)", len(self._processes))
        for key in list(self._processes.keys()):
            managed = self._processes[key]
            if managed.status == "running":
                _kill_process_tree(managed.pid)
                for task in (managed.stdout_task, managed.stderr_task):
                    if task and not task.done():
                        task.cancel()
            # Clean up this process's log dir
            if managed.log_dir.exists():
                shutil.rmtree(managed.log_dir, ignore_errors=True)
        self._processes.clear()

    async def _read_stream(
        self, managed: ManagedProcess, stream: asyncio.StreamReader, stream_name: str
    ) -> None:
        """Background task: read lines, write to log file, broadcast to Terminal."""
        level = "info" if stream_name == "stdout" else "error"
        source = f"process:{managed.name}"
        log_file = managed.log_dir / f"{stream_name}.log"

        try:
            with open(log_file, "a", encoding="utf-8", errors="replace") as f:
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    text = line.decode(errors="replace").rstrip()

                    # Write to log file
                    f.write(text + "\n")
                    f.flush()

                    if stream_name == "stdout":
                        managed.stdout_lines += 1
                    else:
                        managed.stderr_lines += 1

                    # Broadcast to Terminal tab
                    if self._broadcaster:
                        await self._broadcaster.broadcast_terminal_log({
                            "timestamp": datetime.now().isoformat(),
                            "level": level,
                            "message": text,
                            "source": source,
                        })
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug("[Process] Stream reader %s/%s ended: %s", managed.name, stream_name, e)

        # Stream EOF -- capture exit code (only stdout reader does this)
        if managed.status == "running" and stream_name == "stdout":
            try:
                managed.exit_code = await asyncio.wait_for(managed.process.wait(), timeout=5)
            except (asyncio.TimeoutError, Exception):
                managed.exit_code = managed.process.returncode
            managed.status = "stopped" if managed.exit_code == 0 else "error"
            logger.info("[Process] Exited: %s (exit=%s)", managed.name, managed.exit_code)

    @staticmethod
    def _info(m: ManagedProcess) -> Dict[str, Any]:
        return {
            "name": m.name,
            "command": m.command,
            "pid": m.pid,
            "status": m.status,
            "started_at": m.started_at,
            "exit_code": m.exit_code,
            "working_directory": m.working_directory,
            "stdout_lines": m.stdout_lines,
            "stderr_lines": m.stderr_lines,
            "log_dir": str(m.log_dir),
        }


def _kill_process_tree(pid: int) -> None:
    """Kill a process and all descendants (cross-platform via psutil)."""
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


# -- Singleton --

_instance: Optional[ProcessService] = None


def get_process_service() -> ProcessService:
    global _instance
    if _instance is None:
        _instance = ProcessService()
    return _instance


async def shutdown_process_service() -> None:
    if _instance is not None:
        await _instance.shutdown()
