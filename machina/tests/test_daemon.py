"""Smoke tests for ``machina.commands.daemon``."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

from machina.commands import daemon


def test_install_dir_uses_project_root_by_default():
    with patch.object(daemon, "project_root", return_value=Path("/proj")):
        assert daemon._install_dir(None) == Path("/proj")


def test_install_dir_resolves_explicit_override(tmp_path: Path):
    assert daemon._install_dir(str(tmp_path)) == tmp_path.resolve()


def test_venv_python_chooses_layout_per_platform():
    install_dir = Path("/x")
    with patch.object(daemon, "IS_WINDOWS", True):
        assert daemon._venv_python(install_dir).name == "python.exe"
    with patch.object(daemon, "IS_WINDOWS", False):
        assert daemon._venv_python(install_dir).name == "python"


def test_linux_unit_text_includes_user_memory_and_paths(tmp_path: Path):
    text = daemon._linux_unit_text(
        tmp_path, service_user="bob", memory="3G",
    )
    assert "User=bob" in text
    assert "MemoryMax=3G" in text
    assert f"WorkingDirectory={tmp_path / 'server'}" in text
    assert "ExecStart=" in text
    assert "uvicorn main:app" in text


def test_mac_plist_text_uses_label_and_paths(tmp_path: Path):
    text = daemon._mac_plist_text(tmp_path)
    assert f"<string>{daemon.PLIST_LABEL}</string>" in text
    assert "main:app" in text
    assert "0.0.0.0" in text


def test_mac_plist_path_under_launchagents():
    path = daemon._mac_plist_path()
    assert path.name == f"{daemon.PLIST_LABEL}.plist"
    # Sanity: should resolve under user's home Library/LaunchAgents.
    assert "LaunchAgents" in str(path)


def test_dispatch_simple_routes_per_platform():
    """Each verb hits the right handler for the current platform."""
    install_dir = Path("/x")
    with patch.object(daemon, "_windows_status") as win, \
         patch.object(daemon, "_linux_status") as lin, \
         patch.object(daemon, "_mac_status") as mac:
        if sys.platform == "win32":
            daemon._dispatch_simple("status", install_dir)
            win.assert_called_once_with(install_dir)
        elif sys.platform == "darwin":
            daemon._dispatch_simple("status", install_dir)
            mac.assert_called_once_with(install_dir)
        else:
            daemon._dispatch_simple("status", install_dir)
            lin.assert_called_once_with(install_dir)
