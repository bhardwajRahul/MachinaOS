"""LLM provider credentials (Wave 11.E.1 — per-domain).

One :class:`ApiKeyCredential` per provider. Used by the chat-model
plugins in this folder (openai, anthropic, gemini, openrouter, groq,
cerebras, deepseek, kimi, mistral, ollama, lmstudio) plus the xAI
credential referenced by agent plugins. At execution time the plugin's
LangChain / native SDK client pulls the key directly from
:mod:`services.auth`; this class is the Credentials-modal + discovery
manifest, not the runtime client.

Local servers (Ollama, LM Studio) follow the same shape as the cloud
credentials but their api_key is optional — many users run them on
localhost with no auth. The existing ``{provider}_proxy`` mechanism
in :func:`services.ai.AIService.create_model` already handles the
"override base_url + use placeholder api_key" path; the credential
class only needs to return a placeholder when nothing is stored so
the central "API key is required" check in ``execute_chat`` passes.
"""

from __future__ import annotations

from typing import Any, Dict

from services.plugin.credential import ApiKeyCredential


class _LLMApiKey(ApiKeyCredential):
    """Shared defaults. Subclasses only set id / display_name / icon."""

    category = "AI"
    key_name = "Authorization"
    key_location = "bearer"


class OpenAICredential(_LLMApiKey):
    id = "openai"
    display_name = "OpenAI"
    icon = "asset:openai"
    docs_url = "https://platform.openai.com/api-keys"


class AnthropicCredential(_LLMApiKey):
    id = "anthropic"
    display_name = "Anthropic"
    icon = "asset:anthropic"
    docs_url = "https://console.anthropic.com/settings/keys"
    # Anthropic uses ``x-api-key`` not Bearer.
    key_name = "x-api-key"
    key_location = "header"


class GeminiCredential(_LLMApiKey):
    id = "gemini"
    display_name = "Google Gemini"
    icon = "asset:gemini"
    docs_url = "https://ai.google.dev/gemini-api/docs/api-key"
    key_name = "key"
    key_location = "query"


class OpenRouterCredential(_LLMApiKey):
    id = "openrouter"
    display_name = "OpenRouter"
    icon = "asset:openrouter"
    docs_url = "https://openrouter.ai/keys"


class GroqCredential(_LLMApiKey):
    id = "groq"
    display_name = "Groq"
    icon = "asset:groq"
    docs_url = "https://console.groq.com/keys"


class CerebrasCredential(_LLMApiKey):
    id = "cerebras"
    display_name = "Cerebras"
    icon = "asset:cerebras"
    docs_url = "https://cloud.cerebras.ai/"


class DeepSeekCredential(_LLMApiKey):
    id = "deepseek"
    display_name = "DeepSeek"
    icon = "asset:deepseek"
    docs_url = "https://platform.deepseek.com/api_keys"


class KimiCredential(_LLMApiKey):
    id = "kimi"
    display_name = "Kimi (Moonshot)"
    icon = "asset:kimi"
    docs_url = "https://platform.moonshot.cn"


class MistralCredential(_LLMApiKey):
    id = "mistral"
    display_name = "Mistral AI"
    icon = "asset:mistral"
    docs_url = "https://console.mistral.ai/api-keys/"


class XaiCredential(_LLMApiKey):
    id = "xai"
    display_name = "xAI (Grok)"
    icon = "asset:xai"
    docs_url = "https://console.x.ai"


class _LocalLLM(_LLMApiKey):
    """Base for local-server credentials (Ollama, LM Studio).

    Same shape as :class:`_LLMApiKey`, but ``resolve()`` returns the
    documented Ollama placeholder when no key is stored instead of
    raising. The user's custom server address rides on the existing
    ``{id}_proxy`` credential — :func:`services.ai.AIService.create_model`
    already reads it and OpenAIProvider already overrides ``base_url``
    + forces ``api_key="ollama"``. Nothing else to wire.
    """

    @classmethod
    async def resolve(cls, *, user_id: str = "owner") -> Dict[str, Any]:
        from core.container import container

        api_key = await container.auth_service().get_api_key(cls.id)
        return {"api_key": api_key or "ollama"}


class OllamaCredential(_LocalLLM):
    id = "ollama"
    display_name = "Ollama"
    icon = "lobehub:ollama"
    docs_url = "https://ollama.com/download"


class LMStudioCredential(_LocalLLM):
    id = "lmstudio"
    display_name = "LM Studio"
    icon = "lobehub:lmstudio"
    docs_url = "https://lmstudio.ai/docs/local-server"
