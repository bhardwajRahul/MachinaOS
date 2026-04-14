"""Wave 6 NodeSpec contract tests.

Locks in the public shape emitted by services/node_input_schemas.py,
services/node_spec.py, services/node_option_loaders, and the
/api/schemas/nodes/*/spec.json + /api/schemas/nodes/options/* endpoints.
Mirrors the Wave 3 test posture for node_output_schemas.
"""

import pytest  # noqa: F401  (used by @pytest.mark.asyncio on Phase 4 tests)

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
        # apify has an output schema but no input model and no metadata yet
        # (Phase 3d.ii target). Spec still emits with id-fallback metadata.
        spec = get_node_spec("apify")
        assert spec is not None
        assert spec["type"] == "apify"
        assert spec["displayName"] == "apify"  # falls back to id
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


class TestPhase3dCoverage:
    """Phase 3d.i backend parity: location + scheduler + chat + text + 16
    Android service nodes + gmail trigger. All Pydantic models existed
    before this sub-commit - it adds NODE_METADATA entries only."""

    PHASE_3D_TYPES = [
        # Location
        "gmaps_create", "gmaps_locations", "gmaps_nearby_places",
        # Scheduler / triggers
        "cronScheduler", "timer", "gmailReceive",
        # Chat / text
        "chatSend", "chatHistory", "textGenerator", "fileHandler",
        # Android (16)
        "batteryMonitor", "networkMonitor", "systemInfo", "location",
        "appLauncher", "appList", "wifiAutomation", "bluetoothAutomation",
        "audioAutomation", "deviceStateAutomation", "screenControlAutomation",
        "airplaneModeControl", "motionDetection", "environmentalSensors",
        "cameraControl", "mediaControl",
    ]

    def test_all_have_metadata(self):
        from models.node_metadata import get_node_metadata
        missing = [t for t in self.PHASE_3D_TYPES if get_node_metadata(t) is None]
        assert not missing, f"Phase 3d.i types missing metadata: {missing}"

    def test_all_have_full_spec(self):
        for t in self.PHASE_3D_TYPES:
            spec = get_node_spec(t)
            assert spec is not None, f"No spec for {t}"
            assert spec["displayName"] != t, f"{t} fell back to id displayName"
            assert spec["group"], f"{t} missing group"

    def test_android_services_grouped(self):
        # Dashboard routes group containing 'android' OR 'service' to SquareNode.
        for t in ["batteryMonitor", "wifiAutomation", "cameraControl"]:
            assert "android" in get_node_spec(t)["group"]

    def test_input_model_coverage_complete(self):
        """Every node type with a Pydantic input model now also has
        display metadata. Phase 3d.i closes the input-model gap."""
        from services.node_input_schemas import NODE_INPUT_MODELS
        from models.node_metadata import NODE_METADATA
        unseeded = [t for t in NODE_INPUT_MODELS if t not in NODE_METADATA]
        assert not unseeded, f"Input-modeled types still missing metadata: {unseeded}"


class TestPhase3dIICoverage:
    """Phase 3d.ii backend parity: 28 previously output-only types now
    have full Pydantic input models + metadata. Closes the long tail
    of integrations: search, browser/scraping, email, Google Workspace,
    document/RAG, filesystem, proxy."""

    PHASE_3D_II_TYPES = [
        # Search
        "braveSearch", "serperSearch", "perplexitySearch",
        # Browser / scraping
        "browser", "crawleeScraper", "httpScraper", "apifyActor",
        # Email
        "emailSend", "emailRead", "emailReceive",
        # Google Workspace
        "gmail", "calendar", "drive", "sheets", "tasks", "contacts",
        # Document / RAG
        "documentParser", "textChunker", "embeddingGenerator",
        "vectorStore", "fileDownloader",
        # Filesystem
        "fileRead", "fileModify", "fsSearch", "shell",
        # Proxy
        "proxyRequest", "proxyConfig", "proxyStatus",
    ]

    def test_all_have_input_schema(self):
        from services.node_input_schemas import get_node_input_schema
        missing = [t for t in self.PHASE_3D_II_TYPES if get_node_input_schema(t) is None]
        assert not missing, f"Phase 3d.ii types missing input schema: {missing}"

    def test_all_have_metadata(self):
        from models.node_metadata import get_node_metadata
        missing = [t for t in self.PHASE_3D_II_TYPES if get_node_metadata(t) is None]
        assert not missing, f"Phase 3d.ii types missing metadata: {missing}"

    def test_all_have_full_spec(self):
        for t in self.PHASE_3D_II_TYPES:
            spec = get_node_spec(t)
            assert spec is not None, f"No spec for {t}"
            assert spec["displayName"] != t, f"{t} fell back to id displayName"
            assert spec["group"], f"{t} missing group"

    def test_search_nodes_grouped_search_and_tool(self):
        for t in ["braveSearch", "serperSearch", "perplexitySearch"]:
            groups = get_node_spec(t)["group"]
            assert "search" in groups and "tool" in groups

    def test_google_workspace_grouped_google(self):
        for t in ["gmail", "calendar", "drive", "sheets", "tasks", "contacts"]:
            assert "google" in get_node_spec(t)["group"]

    def test_apify_actor_actor_id_field(self):
        spec = get_node_spec("apifyActor")
        assert "actorId" in spec["inputs"]["properties"]

    def test_proxy_request_method_enum(self):
        spec = get_node_spec("proxyRequest")
        method = spec["inputs"]["properties"]["method"]
        assert method["enum"] == ["GET", "POST", "PUT", "DELETE", "PATCH"]


class TestWave6FullCoverage:
    """End-of-Wave-6 invariants: every Pydantic input model has
    metadata; every metadata entry has either an input model or an
    output schema; all 110+ types emit a complete NodeSpec."""

    def test_input_models_have_metadata(self):
        from services.node_input_schemas import NODE_INPUT_MODELS
        from models.node_metadata import NODE_METADATA
        gap = sorted(set(NODE_INPUT_MODELS.keys()) - set(NODE_METADATA.keys()))
        assert not gap, f"Input models without metadata: {gap}"

    def test_total_nodespec_count_at_least_110(self):
        from services.node_spec import list_node_types_with_spec
        assert len(list_node_types_with_spec()) >= 110

    def test_input_model_count_at_least_100(self):
        from services.node_input_schemas import NODE_INPUT_MODELS
        assert len(NODE_INPUT_MODELS) >= 100


class TestPhase4LoadOptions:
    """Wave 6 Phase 4: unified loadOptionsMethod dispatch registry."""

    def test_registry_has_whatsapp_methods(self):
        from services.node_option_loaders import LOAD_OPTIONS_REGISTRY
        for method in ["whatsappGroups", "whatsappChannels", "whatsappGroupMembers"]:
            assert method in LOAD_OPTIONS_REGISTRY

    def test_list_methods_sorted(self):
        from services.node_option_loaders import list_load_options_methods
        methods = list_load_options_methods()
        assert methods == sorted(methods)
        assert len(methods) >= 3

    @pytest.mark.asyncio
    async def test_unknown_method_returns_empty(self):
        from services.node_option_loaders import dispatch_load_options
        result = await dispatch_load_options("nonExistentMethodXyz", {})
        assert result == []

    @pytest.mark.asyncio
    async def test_dispatch_passes_params(self):
        # Smoke test: unknown method tolerates arbitrary params, doesn't crash
        from services.node_option_loaders import dispatch_load_options
        result = await dispatch_load_options("unknown", {"group_id": "abc"})
        assert result == []
