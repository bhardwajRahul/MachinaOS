"""``machina build`` -- replaces ``scripts/build.js``.

Checks toolchain (node, npm, python, uv, temporal-server), then runs
the 5-step build: ``.env`` bootstrap -> ``pnpm install`` -> client
build -> ``uv sync`` -> Playwright -> verify edgymeow binary.

The ``MACHINAOS_BUILDING`` env var is set so ``scripts/postinstall.js``
skips its own ``install.js`` invocation when build is the orchestrator.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import typer

from machina.colors import console
from machina.platform_ import project_root


# ---------------------------------------------------------------- helpers

def _run(cmd: list[str], *, cwd: Path | None = None, check: bool = True) -> int:
    """Inherit-stdio run; raises ``typer.Exit`` on failure when ``check``."""
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    if check and proc.returncode != 0:
        console.print(f"[red]Command failed:[/] {' '.join(cmd)}")
        raise typer.Exit(code=proc.returncode)
    return proc.returncode


def _capture(cmd: list[str]) -> str | None:
    """Capture stdout; return None if the command isn't on PATH or fails."""
    try:
        out = subprocess.run(
            cmd, capture_output=True, text=True, check=True, encoding="utf-8"
        )
        return out.stdout.strip() or out.stderr.strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None


def _which_python() -> str | None:
    """Prefer ``python3`` so we don't pick up Python 2.x on POSIX distros."""
    for cmd in ("python3", "python"):
        if shutil.which(cmd):
            return cmd
    return None


def _check_python(cmd: str) -> bool:
    out = _capture([cmd, "--version"])
    if not out:
        return False
    match = re.search(r"Python (\d+)\.(\d+)", out)
    if not match:
        return False
    major, minor = int(match.group(1)), int(match.group(2))
    if major >= 3 and minor >= 12:
        console.print(f"  {out}")
        return True
    console.print(f"  {out} [red](too old, need 3.12+)[/]")
    return False


def _ensure_pip(python_cmd: str) -> None:
    if not _capture([python_cmd, "-m", "pip", "--version"]):
        console.print("  Installing pip via ensurepip...")
        _run([python_cmd, "-m", "ensurepip", "--upgrade"])


def _ensure_uv(python_cmd: str) -> str:
    """Install ``uv`` via pip if missing; return the resolved version string."""
    version = _capture(["uv", "--version"])
    if version:
        console.print(f"  uv: {version}")
        return version
    _ensure_pip(python_cmd)
    console.print("  Installing uv via pip...")
    _run([python_cmd, "-m", "pip", "install", "uv"])
    version = _capture(["uv", "--version"])
    if not version:
        console.print("[red]Error: failed to install uv. See https://docs.astral.sh/uv/[/]")
        raise typer.Exit(code=1)
    console.print(f"  uv: {version}")
    return version


def _ensure_temporal() -> None:
    """``temporal-server`` is a global npm CLI; install if missing (non-fatal)."""
    version = _capture(["temporal-server", "--version"])
    if version:
        console.print(f"  temporal-server: {version}")
        return
    console.print("  temporal-server: not found, installing globally...")
    rc = _run(["npm", "install", "-g", "temporal-server"], check=False)
    if rc != 0:
        console.print(
            "  [yellow]Warning: temporal-server install failed. "
            "Distributed execution unavailable.[/]"
        )
        return
    version = _capture(["temporal-server", "--version"])
    if version:
        console.print(f"  temporal-server: {version}")


# ---------------------------------------------------------------- build

def build_command() -> None:
    root = project_root()

    # Prevent the postinstall orchestrator from re-running install.js when
    # we're orchestrating ourselves (matches the existing JS contract).
    os.environ["MACHINAOS_BUILDING"] = "true"
    os.environ.setdefault("PYTHONUTF8", "1")

    is_postinstall = os.environ.get("npm_lifecycle_event") == "postinstall"
    is_ci = os.environ.get("CI") == "true" or os.environ.get("GITHUB_ACTIONS") == "true"
    if is_ci and is_postinstall:
        console.print("CI environment detected, skipping postinstall build.")
        return

    # ---- toolchain ---------------------------------------------------
    console.print("[bold]Checking dependencies...[/]\n")
    node_version = _capture(["node", "--version"])
    console.print(f"  Node.js: {node_version or '[red]not found[/]'}")
    if not node_version:
        console.print("[red]Error: Node.js is required.[/]")
        raise typer.Exit(code=1)

    npm_version = _capture(["npm", "--version"])
    console.print(f"  npm: {npm_version or '[red]not found[/]'}")

    python_cmd = _which_python()
    if not python_cmd or not _check_python(python_cmd):
        console.print(
            "[red]Error: Python 3.12+ is required.[/] "
            "Install from https://python.org/downloads/"
        )
        raise typer.Exit(code=1)

    _ensure_uv(python_cmd)
    _ensure_temporal()

    console.print("\n[green]All dependencies ready.[/]\n")

    # ---- build steps -------------------------------------------------
    server_dir = root / "server"
    env_path = root / ".env"
    template_path = root / ".env.template"

    if not env_path.exists() and template_path.exists():
        shutil.copy2(template_path, env_path)
        console.print("[0/5] Created .env from template")

    if not is_postinstall:
        console.print("[1/5] Installing dependencies...")
        _run(["pnpm", "install"], cwd=root)
    else:
        console.print("[1/5] Dependencies already installed by package manager")

    console.print("[2/5] Building client...")
    _run(["pnpm", "--filter", "react-flow-client", "run", "build"], cwd=root)

    console.print("[3/5] Installing Python dependencies...")
    if not (server_dir / ".venv").exists():
        _run(["uv", "venv"], cwd=server_dir)
    _run(["uv", "sync"], cwd=server_dir)

    console.print("[4/5] Installing Playwright browser...")
    rc = _run(["playwright", "install", "chromium"], cwd=server_dir, check=False)
    if rc != 0:
        console.print(
            "  [yellow]Warning: Playwright browser install failed. "
            "JS-rendered scraping unavailable.[/]"
        )

    console.print("[5/5] Verifying edgymeow binary...")
    bin_name = "edgymeow-server.exe" if sys.platform == "win32" else "edgymeow-server"
    edgymeow_bin = root / "node_modules" / "edgymeow" / "bin" / bin_name
    if edgymeow_bin.exists():
        console.print(f"  Binary present: {edgymeow_bin}")
    else:
        console.print(
            "  [yellow]Warning: edgymeow binary not found. "
            "Set WHATSAPP_RUNTIME_ENABLED=false to disable.[/]"
        )

    console.print("\n[green]Build complete.[/]")
