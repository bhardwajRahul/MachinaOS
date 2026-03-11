"""Provider configuration and model resolution.

Loads provider metadata from config/llm_defaults.json.
No LangChain imports -- pure config and resolution logic.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

from core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Provider config dataclass
# ---------------------------------------------------------------------------

@dataclass
class ProviderConfig:
    """Metadata for a single LLM provider."""
    name: str
    default_model: str
    detection_patterns: Tuple[str, ...]
    models_endpoint: str
    api_key_header: str  # e.g. "Authorization", "x-api-key"
    api_key_format: str = "Bearer {key}"  # how the header value is built
    extra_headers: Dict[str, str] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Load config/llm_defaults.json once at import time
# ---------------------------------------------------------------------------

def _load_llm_defaults() -> Dict[str, Any]:
    config_path = Path(__file__).parent.parent.parent / "config" / "llm_defaults.json"
    try:
        with open(config_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Could not load llm_defaults.json: {e}")
        return {"providers": {}}


LLM_DEFAULTS: Dict[str, Any] = _load_llm_defaults()


def reload_defaults() -> None:
    """Reload llm_defaults.json (e.g. after model registry refresh)."""
    global LLM_DEFAULTS
    LLM_DEFAULTS = _load_llm_defaults()


# ---------------------------------------------------------------------------
# Provider registry -- built from llm_defaults.json
# ---------------------------------------------------------------------------

PROVIDER_CONFIGS: Dict[str, ProviderConfig] = {
    "openai": ProviderConfig(
        name="openai",
        default_model=LLM_DEFAULTS.get("providers", {}).get("openai", {}).get("default_model", "gpt-5.2"),
        detection_patterns=("gpt", "openai", "o1", "o3", "o4"),
        models_endpoint="https://api.openai.com/v1/models",
        api_key_header="Authorization",
        api_key_format="Bearer {key}",
    ),
    "anthropic": ProviderConfig(
        name="anthropic",
        default_model=LLM_DEFAULTS.get("providers", {}).get("anthropic", {}).get("default_model", "claude-sonnet-4-6"),
        detection_patterns=("claude", "anthropic"),
        models_endpoint="https://api.anthropic.com/v1/models",
        api_key_header="x-api-key",
        api_key_format="{key}",
        extra_headers={"anthropic-version": "2023-06-01"},
    ),
    "gemini": ProviderConfig(
        name="gemini",
        default_model=LLM_DEFAULTS.get("providers", {}).get("gemini", {}).get("default_model", "gemini-2.5-flash"),
        detection_patterns=("gemini", "google"),
        models_endpoint="https://generativelanguage.googleapis.com/v1beta/models",
        api_key_header="",  # API key in URL query param for Gemini
        api_key_format="",
    ),
    "openrouter": ProviderConfig(
        name="openrouter",
        default_model=LLM_DEFAULTS.get("providers", {}).get("openrouter", {}).get("default_model", "anthropic/claude-sonnet-4.6"),
        detection_patterns=("openrouter",),
        models_endpoint="https://openrouter.ai/api/v1/models",
        api_key_header="Authorization",
        api_key_format="Bearer {key}",
        extra_headers={"HTTP-Referer": "http://localhost:3000", "X-Title": "MachinaOS"},
    ),
    "xai": ProviderConfig(
        name="xai",
        default_model=LLM_DEFAULTS.get("providers", {}).get("xai", {}).get("default_model", "grok-3"),
        detection_patterns=("grok", "xai"),
        models_endpoint="https://api.x.ai/v1/models",
        api_key_header="Authorization",
        api_key_format="Bearer {key}",
    ),
}


def get_provider_config(provider: str) -> Optional[ProviderConfig]:
    return PROVIDER_CONFIGS.get(provider)


# ---------------------------------------------------------------------------
# Provider detection from model name
# ---------------------------------------------------------------------------

def detect_provider_from_model(model: str) -> str:
    model_lower = model.lower()
    for name, cfg in PROVIDER_CONFIGS.items():
        if any(p in model_lower for p in cfg.detection_patterns):
            return name
    return "openai"


def is_model_valid_for_provider(model: str, provider: str) -> bool:
    cfg = PROVIDER_CONFIGS.get(provider)
    if not cfg:
        return True
    model_lower = model.lower()
    return any(p in model_lower for p in cfg.detection_patterns)


# ---------------------------------------------------------------------------
# Default model helpers
# ---------------------------------------------------------------------------

def get_default_model(provider: str) -> str:
    cfg = PROVIDER_CONFIGS.get(provider)
    return cfg.default_model if cfg else "gpt-5.2"


async def get_default_model_async(provider: str, database) -> str:
    """DB user setting > JSON config > fallback."""
    if database:
        try:
            db_defaults = await database.get_provider_defaults(provider)
            if db_defaults and db_defaults.get("default_model"):
                return db_defaults["default_model"]
        except Exception as e:
            logger.warning(f"Failed to get DB defaults for {provider}: {e}")
    return get_default_model(provider)


# ---------------------------------------------------------------------------
# Max-tokens / temperature resolution
# ---------------------------------------------------------------------------

def resolve_max_tokens(params: dict, model: str, provider: str) -> int:
    """Resolve max_tokens: user param -> model registry -> llm_defaults -> 4096."""
    from services.model_registry import get_model_registry
    registry = get_model_registry()
    model_max = registry.get_max_output_tokens(model, provider)

    user_val = params.get("max_tokens") or params.get("maxTokens")
    if user_val:
        user_int = int(user_val)
        if user_int > model_max:
            logger.info(f"[AI] Clamping max_tokens {user_int} -> {model_max} for {provider}/{model}")
            return model_max
        return user_int
    return model_max


def resolve_temperature(params: dict, model: str, provider: str, thinking_enabled: bool) -> float:
    """Resolve temperature with model-specific constraints."""
    from services.model_registry import get_model_registry
    registry = get_model_registry()

    user_temp = float(params.get("temperature", 0.7))

    if registry.is_reasoning_model(model, provider):
        return 1.0

    if thinking_enabled and provider == "anthropic":
        return 1.0

    lo, hi = registry.get_temperature_range(model, provider)
    return max(lo, min(hi, user_temp))


def build_headers(provider: str, api_key: str) -> Dict[str, str]:
    """Build HTTP headers for a provider (used by fetch_models)."""
    cfg = PROVIDER_CONFIGS.get(provider)
    if not cfg:
        return {"Authorization": f"Bearer {api_key}"}
    headers = dict(cfg.extra_headers)
    if cfg.api_key_header:
        headers[cfg.api_key_header] = cfg.api_key_format.format(key=api_key)
    return headers
