"""AI CLI agent framework — multi-provider, multi-instance, VSCode-pattern.

Spawns N parallel Claude Code / Codex CLI sessions per workflow node,
each isolated in its own git worktree, with a shared MCP server hosting
MachinaOs tools (``mcp__machina__*``) discovered via VSCode-style
lockfile.

Self-registers per-provider WebSocket handlers
(``claude_code_login``, ``claude_code_logout``, ``codex_cli_login``,
``codex_cli_logout``) into ``services.ws_handler_registry`` on import,
mirroring the telegram / whatsapp / stripe plugin folder pattern. The
router does not need to know about us by name.
"""

from __future__ import annotations

from services.cli_agent.factory import (
    ALL_PROVIDERS,
    SUPPORTED_PROVIDERS,
    create_cli_provider,
    is_supported,
)
from services.cli_agent.protocol import (
    AICliProvider,
    BatchResult,
    CanonicalUsage,
    SessionResult,
)
from services.cli_agent.types import (
    AICliTaskSpec,
    BaseAICliTaskSpec,
    BatchResultModel,
    BatchSummary,
    ClaudeTaskSpec,
    CodexTaskSpec,
    GeminiTaskSpec,
    SessionResultModel,
    session_result_to_model,
)

# --- self-registration on import -------------------------------------------
from services.ws_handler_registry import register_ws_handlers
from services.cli_agent._handlers import WS_HANDLERS

register_ws_handlers(WS_HANDLERS)


__all__ = [
    # Factory
    "create_cli_provider",
    "is_supported",
    "SUPPORTED_PROVIDERS",
    "ALL_PROVIDERS",
    # Protocol + dataclasses
    "AICliProvider",
    "CanonicalUsage",
    "SessionResult",
    "BatchResult",
    # Pydantic specs
    "BaseAICliTaskSpec",
    "ClaudeTaskSpec",
    "CodexTaskSpec",
    "GeminiTaskSpec",
    "AICliTaskSpec",
    # Pydantic result models
    "SessionResultModel",
    "BatchSummary",
    "BatchResultModel",
    "session_result_to_model",
]
