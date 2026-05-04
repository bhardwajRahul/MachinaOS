"""MCP server integration tests.

Covers:
  - Bearer-token registry: register/lookup/unregister
  - 401 on missing / malformed / wrong / expired tokens
  - Per-batch scoping: tools see the right `BatchContext`
  - Lockfile format (VSCode-shape) + stale-PID sweep
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from services.cli_agent.lockfile import (
    list_active_lockfiles,
    lockfile_path,
    remove_ide_lockfile,
    sweep_stale_lockfiles,
    write_ide_lockfile,
)
from services.cli_agent.mcp_server import (
    BatchContext,
    _reset_for_tests,
    active_batch_count,
    get_mcp_app,
    issue_token,
    lookup_batch,
    register_batch,
    unregister_batch,
)


# ---------------------------------------------------------------------------
# Token registry
# ---------------------------------------------------------------------------

class TestTokenRegistry:
    def setup_method(self):
        _reset_for_tests()

    def test_issue_token_is_random_64_hex(self):
        a = issue_token()
        b = issue_token()
        assert a != b
        assert len(a) == 64
        int(a, 16)  # parses as hex

    def test_register_lookup_unregister(self):
        token = issue_token()
        ctx = BatchContext(
            workflow_id="wf", node_id="n",
            workspace_dir=Path("."),
        )
        assert lookup_batch(token) is None
        register_batch(token, ctx)
        assert lookup_batch(token) is ctx
        assert active_batch_count() == 1
        unregister_batch(token)
        assert lookup_batch(token) is None
        assert active_batch_count() == 0

    def test_unregister_idempotent(self):
        unregister_batch("nonexistent")  # should not raise

    def test_token_collision_with_different_ctx_raises(self):
        token = issue_token()
        ctx1 = BatchContext(workflow_id="a", node_id="n", workspace_dir=Path("."))
        ctx2 = BatchContext(workflow_id="b", node_id="n", workspace_dir=Path("."))
        register_batch(token, ctx1)
        with pytest.raises(ValueError, match="collision"):
            register_batch(token, ctx2)


# ---------------------------------------------------------------------------
# ASGI auth middleware
# ---------------------------------------------------------------------------

class TestAuthMiddleware:
    def setup_method(self):
        _reset_for_tests()

    @pytest.mark.asyncio
    async def test_no_authorization_header_returns_401(self):
        app = get_mcp_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            r = await c.post(
                "/mcp/",
                json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
            )
            assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_malformed_authorization_returns_401(self):
        app = get_mcp_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            r = await c.post(
                "/mcp/",
                json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
                headers={"Authorization": "Token abc"},
            )
            assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_unknown_token_returns_401(self):
        app = get_mcp_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            r = await c.post(
                "/mcp/",
                json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
                headers={"Authorization": "Bearer unknown_token"},
            )
            assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(self):
        """Token registered then unregistered behaves as unknown."""
        token = issue_token()
        register_batch(token, BatchContext(
            workflow_id="wf", node_id="n", workspace_dir=Path("."),
        ))
        unregister_batch(token)
        app = get_mcp_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            r = await c.post(
                "/mcp/",
                json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 401


# ---------------------------------------------------------------------------
# Lockfile format
# ---------------------------------------------------------------------------

class TestLockfile:
    def test_claude_lockfile_path_pid_lock(self, tmp_path):
        path = lockfile_path(
            ide_lockfile_dir=tmp_path,
            pid=12345,
            port=3010,
            ide_name="claude",
        )
        assert path.name == "12345.lock"

    def test_gemini_lockfile_path_includes_port(self, tmp_path):
        path = lockfile_path(
            ide_lockfile_dir=tmp_path,
            pid=12345,
            port=3010,
            ide_name="gemini",
        )
        assert "12345" in path.name
        assert "3010" in path.name
        assert path.name.endswith(".json")

    def test_lockfile_payload_matches_vscode_shape(self, tmp_path):
        path = write_ide_lockfile(
            ide_lockfile_dir=tmp_path,
            pid=99999,
            port=3010,
            token="abc123",
            workspace_dir=tmp_path / "ws",
            ide_name="claude",
        )
        payload = json.loads(path.read_text(encoding="utf-8"))
        # VSCode-style fields
        assert payload["port"] == 3010
        assert payload["authToken"] == "abc123"
        assert payload["ideName"] == "claude"
        assert "url" in payload
        assert "workspaceFolders" in payload
        assert payload["transport"] == "http"
        # Our extra: pid for the stale-sweep
        assert payload["pid"] == 99999

    def test_default_url_constructed(self, tmp_path):
        path = write_ide_lockfile(
            ide_lockfile_dir=tmp_path,
            pid=1, port=3010, token="t",
            workspace_dir=tmp_path, ide_name="claude",
        )
        payload = json.loads(path.read_text(encoding="utf-8"))
        assert payload["url"] == "http://127.0.0.1:3010/mcp/ide"

    def test_remove_lockfile_safe_when_missing(self, tmp_path):
        # Should never raise
        remove_ide_lockfile(None)
        remove_ide_lockfile(tmp_path / "does-not-exist.lock")

    def test_sweep_removes_dead_pid_lockfile(self, tmp_path):
        # Find a guaranteed-dead PID by walking up high. PID 0 is the
        # system idle process on Windows and the swapper on POSIX, so
        # `psutil.pid_exists(0)` returns True everywhere — DON'T use 0.
        import psutil
        dead_pid = 99_999_999
        while psutil.pid_exists(dead_pid):
            dead_pid += 1
            if dead_pid > 999_999_999:  # paranoid bound
                pytest.skip("could not find a dead PID")

        write_ide_lockfile(
            ide_lockfile_dir=tmp_path, pid=dead_pid, port=3010, token="t",
            workspace_dir=tmp_path, ide_name="claude",
        )
        # Write one with the live PID
        live_path = write_ide_lockfile(
            ide_lockfile_dir=tmp_path, pid=os.getpid(), port=3010, token="t",
            workspace_dir=tmp_path, ide_name="claude",
        )

        before = list_active_lockfiles(tmp_path)
        assert len(before) >= 2

        n = sweep_stale_lockfiles(tmp_path)
        # Should have removed at least the dead-PID one
        assert n >= 1

        after = list_active_lockfiles(tmp_path)
        # Live one survives
        assert live_path in after

    def test_sweep_safe_on_nonexistent_dir(self, tmp_path):
        assert sweep_stale_lockfiles(tmp_path / "no") == 0
        assert sweep_stale_lockfiles(None) == 0
