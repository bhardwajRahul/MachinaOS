"""Wave 6 Phase 1 — NodeSpec contract tests.

Locks in the public shape emitted by services/node_input_schemas.py,
services/node_spec.py, and the /api/schemas/nodes/*/spec.json endpoint.
Mirrors the Wave 3 test posture for node_output_schemas.
"""

import pytest

from services.node_input_schemas import (
    NODE_INPUT_MODELS,
    get_node_input_schema,
    list_node_types_with_input_schema,
)
from services.node_spec import get_node_spec, list_node_types_with_spec


class TestInputSchemas:
    def test_registry_not_empty(self):
        assert len(NODE_INPUT_MODELS) > 50

    def test_http_request_schema(self):
        schema = get_node_input_schema("httpRequest")
        assert schema is not None
        props = schema["properties"]
        assert "url" in props
        assert props["method"]["enum"] == ["GET", "POST", "PUT", "DELETE", "PATCH"]
        assert props["timeout"]["minimum"] == 1
        assert props["timeout"]["maximum"] == 300
        # Discriminator stripped from surface
        assert "type" not in props

    def test_ai_agent_schema(self):
        schema = get_node_input_schema("aiAgent")
        assert schema is not None
        props = schema["properties"]
        assert props["temperature"]["minimum"] == 0.0
        assert props["temperature"]["maximum"] == 2.0
        # camelCase aliases present
        assert "apiKey" in props
        assert "maxTokens" in props
        assert "systemMessage" in props

    def test_specialized_agents_share_schema(self):
        # All 16 specialized agents go through SpecializedAgentParams
        for agent_type in ["android_agent", "coding_agent", "deep_agent"]:
            assert get_node_input_schema(agent_type) is not None

    def test_android_service_nodes_covered(self):
        for android_type in ["batteryMonitor", "wifiAutomation", "cameraControl"]:
            assert get_node_input_schema(android_type) is not None

    def test_unknown_type_returns_none(self):
        assert get_node_input_schema("nonExistentNodeXyz") is None

    def test_list_sorted(self):
        types = list_node_types_with_input_schema()
        assert types == sorted(types)


class TestNodeSpec:
    def test_http_request_spec_envelope(self):
        spec = get_node_spec("httpRequest")
        assert spec is not None
        assert spec["type"] == "httpRequest"
        assert spec["displayName"] == "HTTP Request"
        assert "utility" in spec["group"]
        assert "inputs" in spec
        assert "outputs" in spec
        assert spec["version"] == 1

    def test_spec_fallback_metadata_when_unseeded(self):
        # gmaps_create has an input model but no metadata yet
        # (Phase 3d target).
        spec = get_node_spec("gmaps_create")
        assert spec is not None
        assert spec["type"] == "gmaps_create"
        assert spec["displayName"] == "gmaps_create"  # falls back to id
        assert spec["group"] == []

    def test_spec_missing_entirely(self):
        assert get_node_spec("nonExistentNodeXyz") is None

    def test_spec_count_at_or_above_100(self):
        # input (67) + output (98) with overlap ≥ 100 unique types
        assert len(list_node_types_with_spec()) >= 100

    def test_spec_cached(self):
        s1 = get_node_spec("httpRequest")
        s2 = get_node_spec("httpRequest")
        assert s1 is s2  # same dict object — cache hit


class TestPhase3aCoverage:
    """Phase 3a backend parity: utility + code + process + workflow groups
    must all have full NodeSpec (input model + display metadata) before
    Phase 3e flips the VITE_NODESPEC_BACKEND flag."""

    PHASE_3A_TYPES = [
        # utility
        "httpRequest", "webhookTrigger", "webhookResponse",
        "chatTrigger", "console", "teamMonitor",
        # code
        "pythonExecutor", "javascriptExecutor", "typescriptExecutor",
        # process
        "processManager",
        # workflow
        "start", "taskTrigger",
    ]

    def test_all_have_input_schema(self):
        from services.node_input_schemas import get_node_input_schema
        missing = [t for t in self.PHASE_3A_TYPES if get_node_input_schema(t) is None]
        assert not missing, f"Phase 3a types missing input schema: {missing}"

    def test_all_have_metadata(self):
        from models.node_metadata import get_node_metadata
        missing = [t for t in self.PHASE_3A_TYPES if get_node_metadata(t) is None]
        assert not missing, f"Phase 3a types missing display metadata: {missing}"

    def test_all_have_full_spec(self):
        for t in self.PHASE_3A_TYPES:
            spec = get_node_spec(t)
            assert spec is not None, f"No spec for {t}"
            assert spec["displayName"] != t, f"{t} fell back to id displayName — metadata missing"
            assert spec["icon"], f"{t} missing icon"
            assert spec["group"], f"{t} missing group"

    def test_process_manager_operation_enum(self):
        spec = get_node_spec("processManager")
        op = spec["inputs"]["properties"]["operation"]
        assert op["enum"] == ["start", "stop", "restart", "send_input", "list", "get_output"]

    def test_console_log_mode_enum(self):
        spec = get_node_spec("console")
        log_mode = spec["inputs"]["properties"]["logMode"]
        assert log_mode["enum"] == ["full", "field", "expression"]


class TestPhase3bCoverage:
    """Phase 3b backend parity: messaging group (whatsapp, telegram,
    twitter, social) - 11 types."""

    PHASE_3B_TYPES = [
        "whatsappSend", "whatsappReceive", "whatsappDb",
        "telegramSend", "telegramReceive",
        "twitterSend", "twitterReceive", "twitterSearch", "twitterUser",
        "socialReceive", "socialSend",
    ]

    def test_all_have_input_schema(self):
        from services.node_input_schemas import get_node_input_schema
        missing = [t for t in self.PHASE_3B_TYPES if get_node_input_schema(t) is None]
        assert not missing, f"Phase 3b types missing input schema: {missing}"

    def test_all_have_metadata(self):
        from models.node_metadata import get_node_metadata
        missing = [t for t in self.PHASE_3B_TYPES if get_node_metadata(t) is None]
        assert not missing, f"Phase 3b types missing display metadata: {missing}"

    def test_all_have_full_spec(self):
        for t in self.PHASE_3B_TYPES:
            spec = get_node_spec(t)
            assert spec is not None, f"No spec for {t}"
            assert spec["displayName"] != t, f"{t} fell back to id displayName"
            assert spec["group"], f"{t} missing group"

    def test_twitter_send_action_enum(self):
        spec = get_node_spec("twitterSend")
        action = spec["inputs"]["properties"]["action"]
        assert action["enum"] == ["tweet", "reply", "retweet", "like", "unlike", "delete"]

    def test_telegram_send_parse_mode_enum(self):
        spec = get_node_spec("telegramSend")
        parse_mode = spec["inputs"]["properties"]["parseMode"]
        assert parse_mode["enum"] == ["Auto", "HTML", "Markdown", "MarkdownV2", "None"]

    def test_social_send_platform_enum(self):
        spec = get_node_spec("socialSend")
        platform = spec["inputs"]["properties"]["platform"]
        assert "whatsapp" in platform["enum"]
        assert "telegram" in platform["enum"]
        assert "discord" in platform["enum"]


class TestPhase3cCoverage:
    """Phase 3c backend parity: agents (3 base + 16 specialized) +
    chat models (9). All Pydantic models existed before Phase 3c -
    this sub-commit only adds NODE_METADATA entries."""

    PHASE_3C_TYPES = [
        # Base agents
        "aiAgent", "chatAgent", "simpleMemory",
        # Specialized agents (16)
        "android_agent", "coding_agent", "web_agent", "task_agent",
        "social_agent", "travel_agent", "tool_agent", "productivity_agent",
        "payments_agent", "consumer_agent", "autonomous_agent",
        "orchestrator_agent", "ai_employee", "rlm_agent",
        "claude_code_agent", "deep_agent",
        # Chat models (9)
        "openaiChatModel", "anthropicChatModel", "geminiChatModel",
        "openrouterChatModel", "groqChatModel", "cerebrasChatModel",
        "deepseekChatModel", "kimiChatModel", "mistralChatModel",
    ]

    def test_all_have_metadata(self):
        from models.node_metadata import get_node_metadata
        missing = [t for t in self.PHASE_3C_TYPES if get_node_metadata(t) is None]
        assert not missing, f"Phase 3c types missing metadata: {missing}"

    def test_all_have_full_spec(self):
        for t in self.PHASE_3C_TYPES:
            spec = get_node_spec(t)
            assert spec is not None, f"No spec for {t}"
            assert spec["displayName"] != t, f"{t} fell back to id displayName"
            assert spec["group"], f"{t} missing group"

    def test_chat_models_are_grouped_as_model(self):
        # Dashboard routes group=['model'] -> ModelNode (or SquareNode for AI types).
        for t in ["openaiChatModel", "anthropicChatModel", "geminiChatModel"]:
            assert "model" in get_node_spec(t)["group"]

    def test_specialized_agents_share_pydantic_constraints(self):
        # All 16 specialized agents share SpecializedAgentParams - constraints
        # like temperature 0-2 should appear identically.
        spec = get_node_spec("coding_agent")
        temp = spec["inputs"]["properties"]["temperature"]
        assert temp["minimum"] == 0.0
        assert temp["maximum"] == 2.0
