"""``machina daemon`` -- replaces ``scripts/daemon.js``.

Cross-platform service installer:
- Windows  -> NSSM
- Linux    -> systemd
- macOS    -> launchd

Each verb (install / uninstall / status / start / stop / restart)
dispatches to the appropriate platform implementation. The daemon
runs ``uvicorn main:app --host 0.0.0.0 --port 3010 --log-level warning``
out of ``server/.venv/`` regardless of platform; the only thing that
varies is HOW the OS supervises the resulting process.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import typer
from dotenv import dotenv_values

from machina.colors import console
from machina.platform_ import IS_MACOS, IS_WINDOWS, project_root


SERVICE_NAME = "MachinaOs"
PLIST_LABEL = "com.machina.backend"


app = typer.Typer(
    name="daemon",
    help="Install/manage MachinaOS as a system service.",
    no_args_is_help=True,
    add_completion=False,
)


# ---------------------------------------------------------------- helpers

def _install_dir(override: str | None) -> Path:
    return Path(override).resolve() if override else project_root()


def _venv_python(install_dir: Path) -> Path:
    if IS_WINDOWS:
        return install_dir / "server" / ".venv" / "Scripts" / "python.exe"
    return install_dir / "server" / ".venv" / "bin" / "python"


def _server_dir(install_dir: Path) -> Path:
    return install_dir / "server"


def _logs_dir(install_dir: Path) -> Path:
    return install_dir / "logs"


def _ensure_built(install_dir: Path) -> None:
    py = _venv_python(install_dir)
    if not py.exists():
        console.print(f"[red]Python venv not found at {py}[/]")
        console.print('Run "machina build" first.')
        raise typer.Exit(code=1)


def _run(argv: list[str], *, ignore_error: bool = False) -> int:
    """Inherit-stdio run; honours ``ignore_error`` like the JS version."""
    proc = subprocess.run(argv)
    if proc.returncode != 0 and not ignore_error:
        console.print(f"[red]Command failed:[/] {' '.join(argv)}")
        raise typer.Exit(code=proc.returncode)
    return proc.returncode


def _has(cmd: str) -> bool:
    return shutil.which(cmd) is not None


# ============================================================== Windows

def _nssm_check() -> None:
    if not _has("nssm"):
        console.print("[red]NSSM not found. Install from https://nssm.cc/[/]")
        console.print("Or use: winget install nssm")
        raise typer.Exit(code=1)


def _windows_install(install_dir: Path) -> None:
    _nssm_check()
    _ensure_built(install_dir)

    py = _venv_python(install_dir)
    server = _server_dir(install_dir)
    logs = _logs_dir(install_dir)
    logs.mkdir(parents=True, exist_ok=True)

    console.print(f"Installing {SERVICE_NAME} service...")
    console.print(f"  Directory: {install_dir}")
    console.print(f"  Python:    {py}")

    # Remove any pre-existing service quietly first.
    _run(["nssm", "stop", SERVICE_NAME], ignore_error=True)
    _run(["nssm", "remove", SERVICE_NAME, "confirm"], ignore_error=True)

    _run([
        "nssm", "install", SERVICE_NAME, str(py),
        "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0", "--port", "3010", "--log-level", "warning",
    ])
    _run(["nssm", "set", SERVICE_NAME, "AppDirectory", str(server)])

    # Load .env vars + the standard PYTHON* knobs.
    env_pairs = [f"PYTHONPATH={server}", "PYTHONUTF8=1"]
    env_file = install_dir / ".env"
    if env_file.exists():
        for key, value in dotenv_values(env_file).items():
            if key and value:
                env_pairs.append(f"{key}={value}")
    _run(["nssm", "set", SERVICE_NAME, "AppEnvironmentExtra", " ".join(env_pairs)])
    _run(["nssm", "set", SERVICE_NAME, "Start", "SERVICE_AUTO_START"])
    log_file = str(logs / "service.log")
    _run(["nssm", "set", SERVICE_NAME, "AppStdout", log_file])
    _run(["nssm", "set", SERVICE_NAME, "AppStderr", log_file])
    _run(["nssm", "set", SERVICE_NAME, "AppRotateFiles", "1"])
    _run(["nssm", "set", SERVICE_NAME, "AppRotateBytes", "10485760"])  # 10MB

    console.print("[green]Service installed successfully.[/]")
    console.print(f"Logs: {log_file}")


def _windows_uninstall(_: Path) -> None:
    _nssm_check()
    _run(["nssm", "stop", SERVICE_NAME], ignore_error=True)
    _run(["nssm", "remove", SERVICE_NAME, "confirm"], ignore_error=True)
    console.print("Service uninstalled.")


def _windows_status(_: Path) -> None:
    _nssm_check()
    _run(["nssm", "status", SERVICE_NAME], ignore_error=True)


def _windows_start(_: Path) -> None:
    _nssm_check()
    _run(["nssm", "start", SERVICE_NAME])


def _windows_stop(_: Path) -> None:
    _nssm_check()
    _run(["nssm", "stop", SERVICE_NAME])


def _windows_restart(_: Path) -> None:
    _nssm_check()
    _run(["nssm", "restart", SERVICE_NAME])


# ============================================================== Linux (systemd)

_LINUX_UNIT = "/etc/systemd/system/machina.service"


def _linux_unit_text(install_dir: Path, *, service_user: str, memory: str) -> str:
    venv = install_dir / "server" / ".venv"
    server = install_dir / "server"
    return f"""[Unit]
Description=MachinaOs Backend
After=network.target

[Service]
Type=simple
User={service_user}
WorkingDirectory={server}
EnvironmentFile=-{install_dir}/.env
Environment=PYTHONPATH={server}
Environment=PYTHONUTF8=1
Environment=PATH={venv}/bin:/usr/local/bin:/usr/bin:/bin
ExecStart={venv}/bin/uvicorn main:app --host 0.0.0.0 --port 3010 --log-level warning
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

# Resource limits
MemoryMax={memory}

[Install]
WantedBy=multi-user.target
"""


def _linux_install(install_dir: Path, *, service_user: str, memory: str) -> None:
    _ensure_built(install_dir)
    console.print(f"Installing {SERVICE_NAME} service...")
    console.print(f"  Directory:    {install_dir}")
    console.print(f"  User:         {service_user}")
    console.print(f"  Memory limit: {memory}")

    tmp = Path("/tmp/machina.service")
    tmp.write_text(_linux_unit_text(install_dir, service_user=service_user, memory=memory))

    _run(["sudo", "cp", str(tmp), _LINUX_UNIT])
    _run(["sudo", "systemctl", "daemon-reload"])
    _run(["sudo", "systemctl", "enable", "machina"])

    console.print("[green]Service installed successfully.[/]")
    console.print("Start with: sudo systemctl start machina")
    console.print("View logs:  journalctl -u machina -f")


def _linux_uninstall(_: Path) -> None:
    _run(["sudo", "systemctl", "stop", "machina"], ignore_error=True)
    _run(["sudo", "systemctl", "disable", "machina"], ignore_error=True)
    if Path(_LINUX_UNIT).exists():
        _run(["sudo", "rm", _LINUX_UNIT])
    _run(["sudo", "systemctl", "daemon-reload"])
    console.print("Service uninstalled.")


def _linux_status(_: Path) -> None:
    _run(["systemctl", "status", "machina"], ignore_error=True)


def _linux_start(_: Path) -> None:
    _run(["sudo", "systemctl", "start", "machina"])


def _linux_stop(_: Path) -> None:
    _run(["sudo", "systemctl", "stop", "machina"])


def _linux_restart(_: Path) -> None:
    _run(["sudo", "systemctl", "restart", "machina"])


# ============================================================== macOS (launchd)

def _mac_plist_path() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{PLIST_LABEL}.plist"


def _mac_plist_text(install_dir: Path) -> str:
    venv = install_dir / "server" / ".venv"
    server = install_dir / "server"
    logs = _logs_dir(install_dir)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{venv}/bin/uvicorn</string>
        <string>main:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>3010</string>
        <string>--log-level</string>
        <string>warning</string>
    </array>
    <key>WorkingDirectory</key>
    <string>{server}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>{venv}/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>PYTHONPATH</key>
        <string>{server}</string>
        <key>PYTHONUTF8</key>
        <string>1</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{logs}/service.log</string>
    <key>StandardErrorPath</key>
    <string>{logs}/service.log</string>
</dict>
</plist>
"""


def _mac_install(install_dir: Path) -> None:
    _ensure_built(install_dir)
    logs = _logs_dir(install_dir)
    logs.mkdir(parents=True, exist_ok=True)

    console.print(f"Installing {SERVICE_NAME} service...")
    console.print(f"  Directory: {install_dir}")

    plist_path = _mac_plist_path()
    plist_path.parent.mkdir(parents=True, exist_ok=True)
    _run(["launchctl", "unload", str(plist_path)], ignore_error=True)
    plist_path.write_text(_mac_plist_text(install_dir))

    console.print("[green]Service installed successfully.[/]")
    console.print(f"Plist: {plist_path}")
    console.print(f"Logs:  {logs}/service.log")
    console.print('Start with: machina daemon start')


def _mac_uninstall(_: Path) -> None:
    plist_path = _mac_plist_path()
    _run(["launchctl", "unload", str(plist_path)], ignore_error=True)
    if plist_path.exists():
        plist_path.unlink()
    console.print("Service uninstalled.")


def _mac_status(_: Path) -> None:
    proc = subprocess.run(["launchctl", "list"], capture_output=True, text=True)
    for line in proc.stdout.splitlines():
        if "machina" in line:
            console.print(line)


def _mac_start(_: Path) -> None:
    _run(["launchctl", "load", str(_mac_plist_path())])


def _mac_stop(_: Path) -> None:
    _run(["launchctl", "unload", str(_mac_plist_path())])


def _mac_restart(install_dir: Path) -> None:
    _mac_stop(install_dir)
    _mac_start(install_dir)


# ---------------------------------------------------------------- dispatch

def _platform_label() -> str:
    if IS_WINDOWS:
        return "Windows (NSSM)"
    if IS_MACOS:
        return "macOS (launchd)"
    return "Linux (systemd)"


# Common Typer options reused by every verb.
_dir_opt = typer.Option(None, "--dir", help="Installation directory (default: project root).")
_user_opt = typer.Option(
    None, "--user",
    help="Service user (Linux only; default: current user).",
)
_memory_opt = typer.Option(
    "2G", "--memory",
    help="Memory limit (Linux only; default: 2G).",
)


@app.command("install")
def install_cmd(
    dir: str | None = _dir_opt,
    user: str | None = _user_opt,
    memory: str = _memory_opt,
) -> None:
    """Install MachinaOS as a system service for the current platform."""
    install_dir = _install_dir(dir)
    if IS_WINDOWS:
        _windows_install(install_dir)
    elif IS_MACOS:
        _mac_install(install_dir)
    else:
        service_user = user or os.environ.get("USER") or os.environ.get("USERNAME") or "root"
        _linux_install(install_dir, service_user=service_user, memory=memory)


def _dispatch_simple(verb: str, install_dir: Path) -> None:
    handlers = {
        ("windows", "uninstall"): _windows_uninstall,
        ("windows", "status"):    _windows_status,
        ("windows", "start"):     _windows_start,
        ("windows", "stop"):      _windows_stop,
        ("windows", "restart"):   _windows_restart,
        ("mac", "uninstall"):     _mac_uninstall,
        ("mac", "status"):        _mac_status,
        ("mac", "start"):         _mac_start,
        ("mac", "stop"):          _mac_stop,
        ("mac", "restart"):       _mac_restart,
        ("linux", "uninstall"):   _linux_uninstall,
        ("linux", "status"):      _linux_status,
        ("linux", "start"):       _linux_start,
        ("linux", "stop"):        _linux_stop,
        ("linux", "restart"):     _linux_restart,
    }
    platform = "windows" if IS_WINDOWS else "mac" if IS_MACOS else "linux"
    handlers[(platform, verb)](install_dir)


@app.command("uninstall")
def uninstall_cmd(dir: str | None = _dir_opt) -> None:
    """Remove the system service."""
    _dispatch_simple("uninstall", _install_dir(dir))


@app.command("status")
def status_cmd(dir: str | None = _dir_opt) -> None:
    """Show service status (NSSM / systemctl / launchctl)."""
    _dispatch_simple("status", _install_dir(dir))


@app.command("start")
def start_cmd(dir: str | None = _dir_opt) -> None:
    """Start the system service."""
    _dispatch_simple("start", _install_dir(dir))


@app.command("stop")
def stop_cmd(dir: str | None = _dir_opt) -> None:
    """Stop the system service."""
    _dispatch_simple("stop", _install_dir(dir))


@app.command("restart")
def restart_cmd(dir: str | None = _dir_opt) -> None:
    """Restart the system service."""
    _dispatch_simple("restart", _install_dir(dir))


@app.callback()
def _root() -> None:
    """Cross-platform service installer.

    Platform: detected from sys.platform (Windows -> NSSM,
    macOS -> launchd, Linux -> systemd).
    """
