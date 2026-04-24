"""Contract tests for specialized agent nodes.

Covers:
- 13 generic specialized agents routed to handle_chat_agent
  (android_agent, coding_agent, web_agent, task_agent, social_agent,
  travel_agent, tool_agent, productivity_agent, payments_agent,
  consumer_agent, autonomous_agent, orchestrator_agent, ai_employee)
- 3 dedicated-handler agents (deep_agent, rlm_agent, claude_code_agent)

These freeze the input -> output behaviour documented in
`docs-internal/node-logic-flows/specialized_agents/`. A refactor that breaks
any of these indicates the docs (and the user-visible contract) need to be
updated too.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.nodes._mocks import patched_broadcaster, patched_container, patched_subprocess


pytestmark = pytest.mark.node_contract


# 13 specialized agents that all route to handle_chat_agent.
GENERIC_SPECIALIZED_AGENTS = [
    "android_agent",
    "coding_agent",
    "web_agent",
    "task_agent",
    "social_agent",
    "travel_agent",
    "tool_agent",
    "productivity_agent",
    "payments_agent",
    "consumer_agent",
    "autonomous_agent",
    "orchestrator_agent",
    "ai_employee",
]


TEAM_LEAD_AGENTS = ["orchestrator_agent", "ai_employee"]


# ============================================================================
# Generic specialized agents -- parametrized so we do not repeat 13 near
# identical test bodies.
# ============================================================================


class TestGenericSpecializedAgents:
    """All 13 agents share handle_chat_agent; we verify the dispatch contract
    and the forwarded parameters, not the LLM behaviour."""

    @pytest.mark.parametrize("node_type", GENERIC_SPECIALIZED_AGENTS)
    async def test_dispatch_routes_to_execute_chat_agent(self, harness, node_type):
        # ai_service.execute_chat_agent is already an AsyncMock on the harness.
        with patched_container(auth_api_keys={"openai": "tk"}):
            result = await harness.execute(
                node_type,
                {"provider": "openai", "model": "gpt-4o", "prompt": "hello"},
            )

        harness.assert_envelope(result, success=True)
        assert harness.ai_service.execute_chat_agent.await_count == 1
        # Plugin calls execute_chat_agent(node_id, **kwargs) where kwargs["parameters"] holds the param dict.
        args, kwargs = harness.ai_service.execute_chat_agent.await_args
        assert args[0].startswith(f"test_{node_type}_")
        assert kwargs["parameters"]["provider"] == "openai"
        assert kwargs["parameters"]["model"] == "gpt-4o"
        assert kwargs["parameters"]["prompt"] == "hello"

    @pytest.mark.parametrize("node_type", GENERIC_SPECIALIZED_AGENTS)
    async def test_envelope_payload_shape(self, harness, node_type):
        # Override the mock response so we can assert the propagation.
        harness.ai_service.execute_chat_agent = AsyncMock(
            return_value={
                "success": True,
                "result": {
                    "response": f"hi from {node_type}",
                    "model": "gpt-4o",
                    "provider": "openai",
                },
            }
        )

        with patched_container(auth_api_keys={"openai": "tk"}):
            result = await harness.execute(
                node_type,
                {"provider": "openai", "model": "gpt-4o", "prompt": "x"},
            )

        harness.assert_envelope(result, success=True)
        payload = result["result"]
        assert payload["response"] == f"hi from {node_type}"
        assert payload["model"] == "gpt-4o"
        assert payload["provider"] == "openai"

    async def test_auto_prompt_fallback_from_input_main(self, harness):
        """Empty prompt should fall back to connected input-main output."""
        harness.ai_service.execute_chat_agent = AsyncMock(
            return_value={"success": True, "result": {"response": "ok"}}
        )

        nodes = [
            {"id": "trigger-1", "type": "chatTrigger"},
            {"id": "agent-1", "type": "coding_agent"},
        ]
        edges = [
            {"source": "trigger-1", "target": "agent-1", "targetHandle": "input-main"},
        ]
        ctx = harness.build_context(
            nodes=nodes,
            edges=edges,
            extra={"outputs": {"trigger-1": {"message": "upstream prompt"}}},
        )

        with patched_container(auth_api_keys={"openai": "tk"}):
            await harness.execute(
                "coding_agent",
                {"provider": "openai", "model": "gpt-4o", "prompt": ""},
                node_id="agent-1",
                context=ctx,
            )

        _, kwargs = harness.ai_service.execute_chat_agent.await_args
        assert kwargs["parameters"]["prompt"] == "upstream prompt"

    async def test_task_completion_strips_tools(self, harness):
        """When task_data.status is completed, tool_data is stripped to []."""
        harness.ai_service.execute_chat_agent = AsyncMock(
            return_value={"success": True, "result": {"response": "done"}}
        )

        # Wire a tool and a task trigger to the agent.
        nodes = [
            {"id": "tool-1", "type": "calculatorTool"},
            {"id": "task-1", "type": "taskTrigger"},
            {"id": "agent-1", "type": "coding_agent"},
        ]
        edges = [
            {"source": "tool-1", "target": "agent-1", "targetHandle": "input-tools"},
            {"source": "task-1", "target": "agent-1", "targetHandle": "input-task"},
        ]
        ctx = harness.build_context(
            nodes=nodes,
            edges=edges,
            extra={
                "outputs": {
                    "task-1": {
                        "task_id": "t-1",
                        "status": "completed",
                        "agent_name": "Child",
                        "result": "child result",
                    }
                }
            },
        )

        with patched_container(auth_api_keys={"openai": "tk"}):
            await harness.execute(
                "coding_agent",
                {"provider": "openai", "model": "gpt-4o", "prompt": "do"},
                node_id="agent-1",
                context=ctx,
            )

        _, kwargs = harness.ai_service.execute_chat_agent.await_args
        # Tools should be stripped (kwarg value is None or []).
        assert not kwargs.get("tool_data")

    @pytest.mark.parametrize("node_type", TEAM_LEAD_AGENTS)
    async def test_team_lead_collects_teammates_as_tools(self, harness, node_type):
        """orchestrator_agent / ai_employee append teammates to tool_data."""
        harness.ai_service.execute_chat_agent = AsyncMock(
            return_value={"success": True, "result": {"response": "team"}}
        )

        nodes = [
            {
                "id": "mate-1",
                "type": "coding_agent",
                "data": {"label": "Mate Coder"},
            },
            {"id": "lead-1", "type": node_type},
        ]
        edges = [
            {
                "source": "mate-1",
                "target": "lead-1",
                "targetHandle": "input-teammates",
            },
        ]
        ctx = harness.build_context(nodes=nodes, edges=edges)

        with patched_container(auth_api_keys={"openai": "tk"}):
            await harness.execute(
                node_type,
                {"provider": "openai", "model": "gpt-4o", "prompt": "delegate"},
                node_id="lead-1",
                context=ctx,
            )

        _, kwargs = harness.ai_service.execute_chat_agent.await_args
        tool_data = kwargs.get("tool_data") or []
        assert any(
            t.get("node_id") == "mate-1" and t.get("node_type") == "coding_agent"
            for t in tool_data
        ), f"expected teammate in tool_data, got {tool_data}"

    async def test_non_team_lead_ignores_teammates_handle(self, harness):
        """A non-team-lead (e.g. coding_agent) does not expand input-teammates."""
        harness.ai_service.execute_chat_agent = AsyncMock(
            return_value={"success": True, "result": {"response": "ok"}}
        )

        nodes = [
            {"id": "mate-1", "type": "web_agent", "data": {"label": "mate"}},
            {"id": "agent-1", "type": "coding_agent"},
        ]
        edges = [
            {
                "source": "mate-1",
                "target": "agent-1",
                "targetHandle": "input-teammates",
            },
        ]
        ctx = harness.build_context(nodes=nodes, edges=edges)

        with patched_container(auth_api_keys={"openai": "tk"}):
            await harness.execute(
                "coding_agent",
                {"provider": "openai", "model": "gpt-4o", "prompt": "x"},
                node_id="agent-1",
                context=ctx,
            )

        _, kwargs = harness.ai_service.execute_chat_agent.await_args
        tool_data = kwargs.get("tool_data") or []
        # No teammate expansion happened because coding_agent is not a team lead.
        assert not any(t.get("node_id") == "mate-1" for t in tool_data)

    async def test_failure_envelope_propagates(self, harness):
        harness.ai_service.execute_chat_agent = AsyncMock(
            return_value={"success": False, "error": "model unavailable"}
        )

        with patched_container(auth_api_keys={"openai": "tk"}):
            result = await harness.execute(
                "coding_agent",
                {"provider": "openai", "model": "gpt-4o", "prompt": "x"},
            )

        harness.assert_envelope(result, success=False)
        assert result["error"] == "model unavailable"


# ============================================================================
# Deep Agent
# ============================================================================


class TestDeepAgent:
    def _wire_deep_agent_service(self, harness, response=None):
        """Attach a mock deep_agent_service.execute to the harness AI service."""
        deep_service = MagicMock(name="DeepAgentService")
        deep_service.execute = AsyncMock(
            return_value=response
            or {
                "success": True,
                "result": {
                    "response": "deep done",
                    "model": "claude-sonnet-4-6",
                    "provider": "anthropic",
                },
            }
        )
        harness.ai_service.deep_agent_service = deep_service
        # _build_tool_from_node is passed through as build_tool_fn kwarg.
        harness.ai_service._build_tool_from_node = MagicMock(return_value=None)
        return deep_service

    async def test_happy_path_delegates_to_deep_agent_service(self, harness):
        deep_service = self._wire_deep_agent_service(harness)

        with patched_container(auth_api_keys={"anthropic": "tk"}), patched_broadcaster():
            result = await harness.execute(
                "deep_agent",
                {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-6",
                    "prompt": "plan something",
                },
            )

        harness.assert_envelope(result, success=True)
        assert result["result"]["response"] == "deep done"
        assert deep_service.execute.await_count == 1

    async def test_workspace_dir_injected_into_parameters(self, harness):
        deep_service = self._wire_deep_agent_service(harness)

        ctx = harness.build_context(workspace_dir="/tmp/fake_workspace")

        with patched_container(auth_api_keys={"anthropic": "tk"}), patched_broadcaster():
            await harness.execute(
                "deep_agent",
                {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-6",
                    "prompt": "x",
                },
                context=ctx,
            )

        args, kwargs = deep_service.execute.await_args
        # args[1] is the parameters dict that the handler built.
        assert args[1]["workspace_dir"] == "/tmp/fake_workspace"

    async def test_missing_deep_agent_service_surfaces_as_failure(self, harness):
        """When deep_agent_service is absent, the executor wraps the
        AttributeError into a failure envelope via its generic try/except."""
        # Do NOT attach deep_agent_service. Accessing it on a MagicMock
        # returns a new child mock, so we need to explicitly break it.
        bad_service = MagicMock(spec=[])  # no attributes at all
        harness.ai_service.deep_agent_service = bad_service

        with patched_container(auth_api_keys={"anthropic": "tk"}), patched_broadcaster():
            result = await harness.execute(
                "deep_agent",
                {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-6",
                    "prompt": "x",
                },
            )

        harness.assert_envelope(result, success=False)

    async def test_teammate_handle_collected_for_deep_agent(self, harness):
        deep_service = self._wire_deep_agent_service(harness)

        nodes = [
            {"id": "mate-1", "type": "coding_agent", "data": {"label": "coder"}},
            {"id": "deep-1", "type": "deep_agent"},
        ]
        edges = [
            {
                "source": "mate-1",
                "target": "deep-1",
                "targetHandle": "input-teammates",
            },
        ]
        ctx = harness.build_context(nodes=nodes, edges=edges)

        with patched_container(auth_api_keys={"anthropic": "tk"}), patched_broadcaster():
            await harness.execute(
                "deep_agent",
                {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-6",
                    "prompt": "x",
                },
                node_id="deep-1",
                context=ctx,
            )

        _, kwargs = deep_service.execute.await_args
        teammates = kwargs.get("teammates") or []
        assert any(t["node_id"] == "mate-1" for t in teammates)


# ============================================================================
# RLM Agent
# ============================================================================


class TestRLMAgent:
    def _wire_rlm_service(self, harness, response=None):
        rlm = MagicMock(name="RLMService")
        rlm.execute = AsyncMock(
            return_value=response
            or {
                "success": True,
                "result": {
                    "response": "final answer",
                    "model": "gpt-4o",
                    "provider": "openai",
                    "iterations": 3,
                },
            }
        )
        harness.ai_service.rlm_service = rlm
        return rlm

    async def test_happy_path_delegates_to_rlm_service(self, harness):
        rlm = self._wire_rlm_service(harness)

        with patched_container(auth_api_keys={"openai": "tk"}), patched_broadcaster():
            result = await harness.execute(
                "rlm_agent",
                {
                    "provider": "openai",
                    "model": "gpt-4o",
                    "prompt": "solve this",
                    "maxIterations": 5,
                },
            )

        harness.assert_envelope(result, success=True)
        payload = result["result"]
        assert payload["response"] == "final answer"
        assert payload["iterations"] == 3
        assert rlm.execute.await_count == 1

    async def test_missing_rlm_service_surfaces_as_failure(self, harness):
        bad = MagicMock(spec=[])
        harness.ai_service.rlm_service = bad

        with patched_container(auth_api_keys={"openai": "tk"}), patched_broadcaster():
            result = await harness.execute(
                "rlm_agent",
                {"provider": "openai", "model": "gpt-4o", "prompt": "x"},
            )

        harness.assert_envelope(result, success=False)

    async def test_auto_prompt_fallback(self, harness):
        rlm = self._wire_rlm_service(harness)

        nodes = [
            {"id": "trigger-1", "type": "chatTrigger"},
            {"id": "rlm-1", "type": "rlm_agent"},
        ]
        edges = [
            {"source": "trigger-1", "target": "rlm-1", "targetHandle": "input-main"},
        ]
        ctx = harness.build_context(
            nodes=nodes,
            edges=edges,
            extra={"outputs": {"trigger-1": {"text": "fallback prompt"}}},
        )

        with patched_container(auth_api_keys={"openai": "tk"}), patched_broadcaster():
            await harness.execute(
                "rlm_agent",
                {"provider": "openai", "model": "gpt-4o", "prompt": ""},
                node_id="rlm-1",
                context=ctx,
            )

        args, _ = rlm.execute.await_args
        assert args[1]["prompt"] == "fallback prompt"


# ============================================================================
# Claude Code Agent
# ============================================================================


class TestClaudeCodeAgent:
    def _wire_claude_service(self, result_payload=None):
        service = MagicMock(name="ClaudeCodeService")
        service.execute = AsyncMock(
            return_value=result_payload
            or {
                "result": "cli response",
                "session_id": "sess-abc",
                "usage": {"input_tokens": 10, "output_tokens": 5},
            }
        )
        return service

    async def test_happy_path_spawns_cli_and_returns_response(self, harness):
        service = self._wire_claude_service()

        with patched_container(auth_api_keys={}), patched_broadcaster(), patch(
            "services.claude_code_service.get_claude_code_service",
            return_value=service,
        ):
            result = await harness.execute(
                "claude_code_agent",
                {
                    "prompt": "write a hello world script",
                    "model": "claude-sonnet-4-6",
                    "maxTurns": 5,
                    "maxBudgetUsd": 2.0,
                },
            )

        harness.assert_envelope(result, success=True)
        payload = result["result"]
        assert payload["response"] == "cli response"
        assert payload["provider"] == "anthropic"
        assert payload["session_id"] == "sess-abc"
        assert payload["model"] == "claude-sonnet-4-6"

        # The service was called with the documented kwargs.
        call = service.execute.await_args
        assert call.kwargs["model"] == "claude-sonnet-4-6"
        assert call.kwargs["max_turns"] == 5
        assert call.kwargs["max_budget_usd"] == 2.0
        assert call.kwargs["prompt"] == "write a hello world script"

    async def test_max_budget_usd_flag_is_passed_through(self, harness):
        """Guards against the historical '--max-cost' bug: the handler must
        forward maxBudgetUsd to the service as max_budget_usd."""
        service = self._wire_claude_service()

        with patched_container(auth_api_keys={}), patched_broadcaster(), patch(
            "services.claude_code_service.get_claude_code_service",
            return_value=service,
        ):
            await harness.execute(
                "claude_code_agent",
                {"prompt": "x", "maxBudgetUsd": 7.5},
            )

        call = service.execute.await_args
        assert call.kwargs["max_budget_usd"] == 7.5

    async def test_no_prompt_returns_failure(self, harness):
        """Unique to claude_code_agent: explicit no-prompt short-circuit."""
        service = self._wire_claude_service()

        with patched_container(auth_api_keys={}), patched_broadcaster(), patch(
            "services.claude_code_service.get_claude_code_service",
            return_value=service,
        ):
            result = await harness.execute(
                "claude_code_agent",
                {"prompt": ""},
            )

        harness.assert_envelope(result, success=False)
        assert "prompt" in result["error"].lower()
        # CLI must not have been spawned.
        assert service.execute.await_count == 0

    async def test_subprocess_failure_becomes_envelope(self, harness):
        """When ClaudeCodeService.execute raises, the handler returns
        success=false with the error message."""
        service = MagicMock(name="ClaudeCodeService")
        service.execute = AsyncMock(side_effect=RuntimeError("cli exit 1: boom"))

        with patched_container(auth_api_keys={}), patched_broadcaster(), patch(
            "services.claude_code_service.get_claude_code_service",
            return_value=service,
        ):
            result = await harness.execute(
                "claude_code_agent",
                {"prompt": "do something"},
            )

        harness.assert_envelope(result, success=False)
        assert "boom" in result["error"]

    async def test_auto_prompt_fallback_from_input_main(self, harness):
        service = self._wire_claude_service()

        nodes = [
            {"id": "src-1", "type": "chatTrigger"},
            {"id": "cc-1", "type": "claude_code_agent"},
        ]
        edges = [
            {"source": "src-1", "target": "cc-1", "targetHandle": "input-main"},
        ]
        ctx = harness.build_context(
            nodes=nodes,
            edges=edges,
            extra={"outputs": {"src-1": {"message": "upstream text"}}},
        )

        with patched_container(auth_api_keys={}), patched_broadcaster(), patch(
            "services.claude_code_service.get_claude_code_service",
            return_value=service,
        ):
            await harness.execute(
                "claude_code_agent",
                {"prompt": ""},
                node_id="cc-1",
                context=ctx,
            )

        call = service.execute.await_args
        assert call.kwargs["prompt"] == "upstream text"
