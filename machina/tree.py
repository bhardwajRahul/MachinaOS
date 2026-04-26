"""Cross-platform process-tree control.

The single most important pattern from VS Code's process model:
guarantee that supervised children die when the supervisor dies. On
POSIX we use ``setsid`` + ``killpg``. On Windows we use a Job Object
with ``JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`` so the OS atomically reaps
every descendant when the supervisor handle closes.

References:
- https://nikhilism.com/post/2017/windows-job-objects-process-tree-management/
- microsoft/node-pty (uses Job Objects in production)
"""

from __future__ import annotations

import os
import signal
import sys
from typing import Optional

import psutil


# ---------------------------------------------------------------- POSIX

def new_session_kwargs() -> dict:
    """``Popen``/``open_process`` kwargs to start the child in a new session.

    Empty dict on Windows; uses ``start_new_session`` on POSIX so the
    child is the leader of its own process group and ``killpg`` reaches
    the entire descendant tree.
    """
    if sys.platform == "win32":
        return {}
    return {"start_new_session": True}


def signal_group(pid: int, sig: signal.Signals = signal.SIGTERM) -> None:
    """Send ``sig`` to the process group led by ``pid`` (POSIX only)."""
    if sys.platform == "win32":
        return
    try:
        os.killpg(os.getpgid(pid), sig)
    except ProcessLookupError:
        pass


# ---------------------------------------------------------------- Windows Job Object

class _JobObject:
    """Lazy-imported wrapper around a Windows Job Object."""

    def __init__(self) -> None:
        self._handle = None
        self._win32job = None
        if sys.platform == "win32":
            try:
                import win32job  # type: ignore[import-not-found]

                self._win32job = win32job
                self._handle = win32job.CreateJobObject(None, "")
                info = win32job.QueryInformationJobObject(
                    self._handle, win32job.JobObjectExtendedLimitInformation
                )
                info["BasicLimitInformation"]["LimitFlags"] |= (
                    win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                )
                win32job.SetInformationJobObject(
                    self._handle, win32job.JobObjectExtendedLimitInformation, info
                )
            except Exception:  # pywin32 missing or denied
                self._handle = None

    def add(self, pid: int) -> bool:
        """Enroll ``pid`` in the job. Returns False when unavailable."""
        if self._handle is None or self._win32job is None:
            return False
        try:
            import win32api  # type: ignore[import-not-found]

            handle = win32api.OpenProcess(0x1F0FFF, False, pid)
            self._win32job.AssignProcessToJobObject(self._handle, handle)
            return True
        except Exception:
            return False


_JOB: Optional[_JobObject] = None


def get_job() -> _JobObject:
    global _JOB
    if _JOB is None:
        _JOB = _JobObject()
    return _JOB


def add_to_job(pid: int) -> bool:
    """Best-effort enrollment of ``pid`` in the supervisor's Job Object."""
    if sys.platform != "win32":
        return False
    return get_job().add(pid)


# --------------------------------------------------------------- Tree kill

def kill_tree(pid: int) -> None:
    """Cross-platform tree-kill via psutil. Defensive against races."""
    try:
        parent = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return
    try:
        children = parent.children(recursive=True)
    except psutil.NoSuchProcess:
        children = []
    for child in children:
        try:
            child.kill()
        except psutil.NoSuchProcess:
            pass
    try:
        parent.kill()
    except psutil.NoSuchProcess:
        pass
