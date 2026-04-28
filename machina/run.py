"""Shared subprocess helpers used across ``machina.commands``.

Two patterns covering ~95% of subprocess use in this CLI:

* :func:`run` -- inherit-stdio fire-and-forget; raises ``typer.Exit`` on
  non-zero exit unless ``check=False`` is passed (matches the existing
  build.py / start.py / dev.py call shape).
* :func:`capture` -- run silently, return stdout (stripped) on success
  or ``None`` on missing binary / non-zero exit. Tolerates failure by
  design; the caller branches on truthiness.

Centralising these two functions removes the per-file ``_run`` /
``_capture`` / ``_git_describe`` duplicates that previously diverged
in subtle ways (one had inverted ``ignore_error`` semantics, another
swallowed stderr, etc.).
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import typer

from machina.colors import console


def run(
    argv: list[str],
    *,
    cwd: Path | str | None = None,
    check: bool = True,
) -> int:
    """Inherit-stdio run; raises :class:`typer.Exit` on non-zero when ``check``."""
    proc = subprocess.run(argv, cwd=str(cwd) if cwd else None)
    if check and proc.returncode != 0:
        console.print(f"[red]Command failed:[/] {' '.join(argv)}")
        raise typer.Exit(code=proc.returncode)
    return proc.returncode


def capture(argv: list[str], *, cwd: Path | str | None = None) -> str | None:
    """Capture stdout (or stderr fallback); ``None`` if binary missing or fails.

    Used for "is this tool installed and what version" queries -- always
    tolerant, never raises.
    """
    try:
        result = subprocess.run(
            argv,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            check=True,
            encoding="utf-8",
        )
        return result.stdout.strip() or result.stderr.strip() or None
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None
