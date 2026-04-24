# Native LLM SDK Architecture

> **⚠️ Pre-Wave-11 — historical reference only.**
> Node authoring now happens on the backend: each node is a Python plugin under `server/nodes/<category>/<node>.py` that emits a `NodeSpec`. The frontend reads specs via [client/src/lib/nodeSpec.ts](../client/src/lib/nodeSpec.ts) + [adapters/nodeSpecToDescription.ts](../client/src/adapters/nodeSpecToDescription.ts). See [plugin_system.md](./plugin_system.md) and [server/nodes/README.md](../server/nodes/README.md) for the current model. The snippets below that reference `client/src/nodeDefinitions/*` are kept for historical context.

MachinaOS uses a hybrid LLM architecture: a native SDK layer in `server/services/llm/` for direct chat completions and model fetching, and a LangChain + LangGraph path in `server/services/ai.py` for agent tool-calling. This document describes the native layer, its design, and how both paths coexist.

## Why a Native Layer

LangChain added a useful abstraction early on, but it introduced three recurring problems:

1. **Windows/Python 3.13 hangs**: `langchain_google_genai` deadlocks on gRPC init. The native Gemini path bypasses LangChain entirely and uses `google.genai.Client` directly.
2. **Parameter translation loss**: LangChain's `max_completion_tokens` rewrite breaks OpenAI-compatible providers (DeepSeek, Kimi, Mistral) that expect `max_tokens`.
3. **Hard-coded URLs**: Each provider class in LangChain hard-codes its base URL. The native layer reads `base_url` from `server/config/llm_defaults.json`, so adding an OpenAI-compatible provider is a config change.

The native layer also gives a single normalized response shape (`LLMResponse`) across providers, which simplifies downstream code for token tracking, cost calculation, and thinking extraction.

## Layer Overview

```
server/services/llm/
|-- __init__.py           Public API exports
|-- protocol.py           Message, ToolDef, ToolCall, Usage, LLMResponse, LLMProvider (Protocol)
|-- config.py             ProviderConfig, PROVIDER_CONFIGS (built from llm_defaults.json)
|-- factory.py            create_provider() lazy-import factory, NATIVE_PROVIDERS set
|-- messages.py           filter_empty_messages, is_valid_message_content
`-- providers/
    |-- __init__.py
    |-- anthropic.py      AnthropicProvider (anthropic SDK)
    |-- openai.py         OpenAIProvider (openai SDK)
    |-- gemini.py         GeminiProvider (google-genai SDK)
    `-- openrouter.py     OpenRouterProvider (extends OpenAIProvider with headers)
```

## Supported Providers

The native layer currently supports **10 providers**, grouped by implementation:

| Provider | Implementation | SDK | Notes |
|---|---|---|---|
| `anthropic` | `providers/anthropic.py` | `anthropic` | Extended thinking via `budget_tokens` |
| `openai` | `providers/openai.py` | `openai` | Reasoning models (o1/o3) and GPT-5 hybrid thinking |
| `gemini` | `providers/gemini.py` | `google-genai` | Bypasses LangChain (Windows hang fix) |
| `openrouter` | `providers/openrouter.py` | `openai` | Sets `HTTP-Referer` + `X-Title` headers |
| `xai` | `providers/openai.py` + base_url | `openai` | OpenAI-compatible at `api.x.ai/v1` |
| `deepseek` | `providers/openai.py` + base_url | `openai` | OpenAI-compatible at `api.deepseek.com` |
| `kimi` | `providers/openai.py` + base_url | `openai` | Moonshot AI, OpenAI-compatible |
| `mistral` | `providers/openai.py` + base_url | `openai` | OpenAI-compatible |
| `groq` | LangChain fallback | `langchain-groq` | Not yet on native path |
| `cerebras` | LangChain fallback | `langchain-cerebras` | Not yet on native path |

Source of truth for this list: `server/config/llm_defaults.json` (the `providers` dict) and `server/services/llm/factory.py` (`NATIVE_PROVIDERS` constant).

## Provider Protocol

Every native provider implements a structural Protocol with two methods:

```python
@runtime_checkable
class LLMProvider(Protocol):
    provider_name: str

    async def chat(
        self,
        messages: List[Message],
        *,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        thinking: Optional[ThinkingConfig] = None,
        tools: Optional[List[ToolDef]] = None,
    ) -> LLMResponse: ...

    async def fetch_models(self, api_key: str) -> List[str]: ...
```

All providers return the same `LLMResponse` dataclass, regardless of SDK:

```python
@dataclass
class LLMResponse:
    content: str = ""
    thinking: Optional[str] = None
    tool_calls: List[ToolCall] = field(default_factory=list)
    usage: Usage = field(default_factory=Usage)
    model: str = ""
    finish_reason: str = "stop"
    raw: Any = None
```

Downstream code never special-cases a provider SDK shape.

## Factory and Lazy Imports

Each provider is imported only when first used to avoid loading large SDKs at startup:

```python
# server/services/llm/factory.py
def create_provider(provider: str, api_key: str, *, proxy_url: Optional[str] = None) -> LLMProvider:
    if provider == "anthropic":
        from services.llm.providers.anthropic import AnthropicProvider
        return AnthropicProvider(api_key, proxy_url=proxy_url)

    if provider == "openai":
        from services.llm.providers.openai import OpenAIProvider
        return OpenAIProvider(api_key, proxy_url=proxy_url)

    if provider == "gemini":
        from services.llm.providers.gemini import GeminiProvider
        return GeminiProvider(api_key, proxy_url=proxy_url)

    if provider == "openrouter":
        from services.llm.providers.openrouter import OpenRouterProvider
        return OpenRouterProvider(api_key, proxy_url=proxy_url)

    # OpenAI-compatible providers: reuse OpenAIProvider with base_url from config
    from services.llm.config import get_provider_config
    config = get_provider_config(provider)
    if config and config.base_url:
        from services.llm.providers.openai import OpenAIProvider
        return OpenAIProvider(api_key, base_url=config.base_url, proxy_url=proxy_url)

    raise ValueError(f"Unknown provider: {provider}")
```

`is_native_provider(name)` is the gate used by `AIService.execute_chat()` to choose the native path vs LangChain fallback.

## Config-Driven Base URLs

`ProviderConfig` is built at import time from `llm_defaults.json`:

```python
@dataclass
class ProviderConfig:
    name: str
    default_model: str
    detection_patterns: Tuple[str, ...]
    models_endpoint: str
    api_key_header: str              # "Authorization", "x-api-key"
    api_key_format: str = "Bearer {key}"
    extra_headers: Dict[str, str] = field(default_factory=dict)
    base_url: str = ""               # OpenAI-compatible base URL
```

Adding a new OpenAI-compatible provider is a pure config change:

```json
"deepseek": {
  "default_model": "deepseek-chat",
  "detection_patterns": ["deepseek"],
  "models_endpoint": "https://api.deepseek.com/v1/models",
  "base_url": "https://api.deepseek.com/v1",
  "max_output_tokens": { "_default": 8192 },
  "context_length": { "_default": 128000 },
  "temperature_range": [0.0, 2.0]
}
```

No new provider class, no new import. The factory's fallback branch picks up `base_url` and reuses `OpenAIProvider`.

## Native Path vs LangChain Path

`AIService` in `server/services/ai.py` has two top-level execution methods. They take different routes:

```
execute_chat(parameters, node_id, node_type)          -> native SDK where possible
execute_agent(parameters, node_id)                    -> LangChain + LangGraph
execute_chat_agent(parameters, node_id)               -> LangChain + LangGraph
```

**`execute_chat()` routing:**

```
node_type / model selects provider
        |
        v
is_native_provider(provider)?
        |
        +-- yes --> create_provider(...) -> provider.chat(...) -> LLMResponse
        |
        +-- no  --> self.create_model(...) -> chat_model.invoke(...) -> extract to LLMResponse shape
```

**`execute_agent()` and `execute_chat_agent()` routing:**

All providers go through `create_model()` which returns a LangChain `ChatOpenAI` / `ChatAnthropic` / `ChatGoogleGenerativeAI` / `ChatGroq` / `ChatCerebras` instance. The agent then builds a LangGraph `StateGraph` with `bind_tools()` for tool calling. This path is used because LangGraph's agent loop, checkpointer, and tool-execution callback layer do not have a native-layer equivalent today.

OpenAI-compatible providers like DeepSeek/Kimi/Mistral still use `ChatOpenAI` with `base_url` from `llm_defaults.json` in the agent path, and pass `max_tokens` via `extra_body` to bypass LangChain's `max_completion_tokens` conversion.

## Thinking and Reasoning

The unified `ThinkingConfig` dataclass is translated per provider:

```python
@dataclass
class ThinkingConfig:
    enabled: bool = False
    budget: int = 2048      # Anthropic budget_tokens, Gemini 2.5 thinking_budget
    effort: str = "medium"  # OpenAI reasoning_effort (low/medium/high)
    level: str = "medium"   # Gemini 3+ thinking_level
    format: str = "parsed"  # Groq Qwen3 reasoning_format (parsed/hidden)
```

Each provider's `chat()` method reads only the fields it supports. The extracted thinking text is returned in `LLMResponse.thinking` so downstream nodes can display or drag it into parameters.

See [memory_compaction.md](memory_compaction.md) for how thinking token counts are tracked separately from output tokens.

## Model Max Tokens Resolution

`resolve_max_tokens()` in `services/llm/config.py` implements the clamp/default logic:

```python
def resolve_max_tokens(params: dict, model: str, provider: str) -> int:
    registry = get_model_registry()
    model_max = registry.get_max_output_tokens(model, provider)
    user_val = params.get("max_tokens") or params.get("maxTokens")
    if user_val:
        user_int = int(user_val)
        if user_int > model_max:
            return model_max   # clamp user value to model hard limit
        return user_int
    return model_max
```

Paired with `ModelRegistryService` (`server/services/model_registry.py`), which loads `model_registry.json` (cached from OpenRouter's `/api/v1/models` endpoint) and falls back to `llm_defaults.json` for unknown models. The registry is the single source for:

- `max_output_tokens`
- `context_length`
- `temperature_range`
- `is_reasoning_model` (fixes temperature to 1.0)
- `supports_thinking`
- `thinking_type`

## Adding a New Provider

1. **OpenAI-compatible provider** (DeepSeek, Kimi, Mistral pattern):
   - Add an entry to `llm_defaults.json` with `base_url`, `default_model`, `detection_patterns`, `max_output_tokens._default`, `context_length._default`, `temperature_range`.
   - Add the provider name to `NATIVE_PROVIDERS` in `factory.py` if you want `execute_chat()` to route natively.
   - Add to `PROVIDER_CONFIGS` in `services/ai.py` for LangChain agent path (reuse `ChatOpenAI`, set `base_url` in `create_model()`).

2. **Custom-SDK provider** (Anthropic, Gemini pattern):
   - Create `services/llm/providers/<name>.py` implementing `LLMProvider` protocol.
   - Add a branch in `create_provider()` in `factory.py`.
   - Add the provider name to `_DEDICATED_PROVIDERS` and `NATIVE_PROVIDERS`.
   - Add config entry in `llm_defaults.json` (no `base_url` needed if the SDK handles URLs itself).

3. **Frontend wiring** (in either case):
   - Add node definition in `client/src/nodeDefinitions/aiModelNodes.ts` using `createBaseChatModel()`.
   - Add to `CREDENTIAL_TO_PROVIDER` map in `ModelNode.tsx`.
   - Add credential entry in `CredentialsModal.tsx`.

## Related Docs

- [DESIGN.md](DESIGN.md) - overall backend architecture
- [memory_compaction.md](memory_compaction.md) - token tracking and compaction using this layer
- [pricing_service.md](pricing_service.md) - cost calculation from `LLMResponse.usage`
- [agent_architecture.md](agent_architecture.md) - how agents use LangChain path on top of this layer
