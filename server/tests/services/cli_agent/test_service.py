"""`AICliService` tests — fail-fast paths that don't spawn the CLI.

The full subprocess-driven path is covered by live verification (see
`docs-internal/cli_agent_framework.md` → Verification §5–7). These unit
tests cover:
  - `working_directory_not_git_repo` abort (no pool constructed)
  - resolver contract: explicit `repo_root` doesn't fall back to cwd
  - factory NotImplementedError surfaces cleanly
  - cancel_workflow / cancel_node return zero when nothing's running
"""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

import pytest

from services.cli_agent import ClaudeTaskSpec, CodexTaskSpec
from services.cli_agent.service import AICliService, get_ai_cli_service


@pytest.mark.asyncio
async def test_not_git_repo_returns_structured_failure():
    """Caller-supplied repo_root that isn't a git repo → fail-fast,
    every task surfaces `working_directory_not_git_repo`."""
    svc = AICliService()
    with tempfile.TemporaryDirectory() as tmp:
        result = await svc.run_batch(
            "claude",
            tasks=[
                ClaudeTaskSpec(prompt="task A"),
                ClaudeTaskSpec(prompt="task B"),
            ],
            node_id="n",
            workflow_id="wf",
            workspace_dir=Path(tmp),
            broadcaster=None,
            repo_root=Path(tmp),  # explicit non-git
        )

    assert result.n_tasks == 2
    assert result.n_succeeded == 0
    assert result.n_failed == 2
    assert all(t.error == "working_directory_not_git_repo" for t in result.tasks)
    assert result.total_cost_usd is None


@pytest.mark.asyncio
async def test_explicit_repo_root_does_not_fallback_to_cwd():
    """When the caller passes an explicit `repo_root`, the resolver
    must NOT walk to cwd. This is the bug we fixed during Phase 5
    smoke-testing."""
    # cwd is the framework worktree (a git repo). If the resolver fell
    # back, it would silently succeed — bad.
    svc = AICliService()
    with tempfile.TemporaryDirectory() as tmp:
        result = await svc.run_batch(
            "claude",
            tasks=[ClaudeTaskSpec(prompt="x")],
            node_id="n",
            workflow_id="wf",
            workspace_dir=Path(tmp),
            broadcaster=None,
            repo_root=Path(tmp),
        )
    assert result.n_failed == 1
    assert result.tasks[0].error == "working_directory_not_git_repo"


@pytest.mark.asyncio
async def test_codex_provider_works():
    """Codex factory must build a provider; happy-path argv was already
    covered in test_providers.py."""
    svc = AICliService()
    with tempfile.TemporaryDirectory() as tmp:
        # Same not-git-repo path with Codex — confirms the provider
        # discrim works through the service.
        result = await svc.run_batch(
            "codex",
            tasks=[CodexTaskSpec(prompt="x", sandbox="read-only")],
            node_id="n",
            workflow_id="wf",
            workspace_dir=Path(tmp),
            broadcaster=None,
            repo_root=Path(tmp),
        )
    assert result.provider == "codex"
    assert result.tasks[0].provider == "codex"


@pytest.mark.asyncio
async def test_gemini_factory_raises_not_implemented():
    svc = AICliService()
    with tempfile.TemporaryDirectory() as tmp:
        with pytest.raises(NotImplementedError, match="deferred to v2"):
            await svc.run_batch(
                "gemini",
                tasks=[],  # spec irrelevant — factory raises before construction
                node_id="n",
                workflow_id="wf",
                workspace_dir=Path(tmp),
                broadcaster=None,
                repo_root=Path(tmp),
            )


@pytest.mark.asyncio
async def test_cancel_when_no_active_pools():
    svc = AICliService()
    assert await svc.cancel_workflow("nothing") == 0
    assert await svc.cancel_node("nothing") == 0


def test_singleton_accessor_returns_same_instance():
    a = get_ai_cli_service()
    b = get_ai_cli_service()
    assert a is b


@pytest.mark.asyncio
async def test_resolver_walks_upward_to_find_git():
    """Without `override`, the resolver tries workspace_dir then cwd.

    The cli-agent-framework worktree is a git repo. A deep child path
    should resolve via `git rev-parse --show-toplevel` to the worktree root.
    """
    deep = Path(__file__).resolve().parent / "deep" / "deeper"
    root = await AICliService._resolve_repo_root(workspace_dir=deep, override=None)
    assert root is not None
    assert (root / ".git").exists()


@pytest.mark.asyncio
async def test_resolver_returns_none_when_override_not_git():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        root = await AICliService._resolve_repo_root(
            workspace_dir=Path(tmp),  # ignored when override is set
            override=Path(tmp),
        )
        assert root is None
