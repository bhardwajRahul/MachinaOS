# OpenAI Chat Model (`openaiChatModel`)

| Field | Value |
|------|-------|
| **Category** | ai_chat_models |
| **Frontend definition** | [`client/src/nodeDefinitions/aiModelNodes.ts`](../../../client/src/nodeDefinitions/aiModelNodes.ts) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_ai_chat_model`](../../../server/services/handlers/ai.py) |
| **AI service** | [`server/services/ai.py::AIService.execute_chat`](../../../server/services/ai.py) |
| **Tests** | [`server/tests/nodes/test_ai_chat_models.py`](../../../server/tests/nodes/test_ai_chat_models.py) |
| **Skill (if any)** | n/a - chat models are model config nodes, not tools |
| **Dual-purpose tool** | no - pure chat completion node |

## Purpose

Single-turn chat completion against the OpenAI REST API. Used either as a standalone workflow node (user enters a prompt, the node produces a response) or as a model config node wired into an AI Agent via the `input-model` handle. All 9 chat-model node types share the same handler (`handle_ai_chat_model`) and the same dispatch path; per-provider differences live inside `AIService.execute_chat` (native SDK for OpenAI) and in the clamp / temperature helpers.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream data; not consumed directly by the handler - prompt must be passed via `parameters` or template-resolved upstream |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `prompt` | string | `""` | yes (non-empty) | - | User message content sent to the model |
| `systemMessage` / `systemPrompt` / `system_prompt` | string | `""` | no | - | System prompt; any of the three naming conventions accepted |
| `model` | string | auto-populated from stored models, fallback `gpt-3.5-turbo` | no | - | Model ID. `[FREE] ` prefix is stripped before the API call |
| `temperature` | number | provider default | no | - | 0-2 for most OpenAI models; o-series (o1/o3/o4) force temperature=1 |
| `maxTokens` / `max_tokens` | number | provider default | no | - | Clamped via `_resolve_max_tokens` to the model's actual context limit |
| `topP` | number | 1.0 | no | - | Nucleus sampling |
| `frequencyPenalty` | number | 0 | no | - | OpenAI penalty |
| `presencePenalty` | number | 0 | no | - | OpenAI penalty |
| `responseFormat` | options | `text` | no | - | `text` or `json_object` |
| `thinkingEnabled` | boolean | false | no | - | Turn on extended reasoning (GPT-5 hybrid / o-series) |
| `reasoningEffort` | options | `medium` | no | `thinkingEnabled=[true]` | `minimal` / `low` / `medium` / `high` |
| `apiKey` / `api_key` | string | injected by executor | no | - | Auto-injected by `NodeExecutor._inject_api_keys` via `auth_service.get_api_key('openai', 'default')` |
| `options` | object | `{}` | no | - | Collection bag; flattened into the top-level params dict before use |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Standard envelope payload (see below) |

### Output payload

```ts
{
  response: string;
  thinking: string | null;
  thinking_enabled: boolean;
  model: string;
  provider: 'openai';
  finish_reason: string;
  timestamp: string;  // ISO 8601
  input: { prompt: string; system_prompt: string };
}
```

Wrapped in the standard envelope: `{ success: true, node_id, node_type, result: <payload>, execution_time: number }`.

## Logic Flow

```mermaid
flowchart TD
  A[NodeExecutor dispatch] --> B[_prepare_parameters:<br/>merge DB params, validate, inject api_key + model]
  B --> C[handle_ai_chat_model]
  C --> D[AIService.execute_chat]
  D --> E[Flatten options into flat params dict]
  E --> F{api_key present?}
  F -- no --> X[raise ValueError -> error envelope]
  F -- yes --> G{prompt non-empty?}
  G -- no --> X
  G -- yes --> H[detect_ai_provider -> 'openai']
  H --> I[Build NativeThinkingConfig if thinkingEnabled]
  I --> J[Lookup openai_proxy credential]
  J --> K{is_native_provider?}
  K -- yes for openai --> L[Native path:<br/>create_provider openai + OpenAI SDK<br/>await provider.chat]
  L --> M[Build response dict<br/>response / thinking / model / provider / finish_reason]
  M --> N[Return success envelope]
  L -- Exception --> X
```

## Decision Logic

- **Validation**: missing `api_key` -> ValueError; empty/whitespace `prompt` (via `is_valid_message_content`) -> ValueError. Both produce a `success=false` envelope.
- **Provider routing**: `detect_ai_provider(node_type)` returns `'openai'` for this node; falls through the else branch in `constants.detect_ai_provider`.
- **Native vs LangChain**: `is_native_provider('openai')` is True, so the native `openai` SDK is used via `create_provider('openai', api_key, proxy_url=...)`.
- **Model string scrubbing**: strips `[FREE] ` prefix if present. For non-OpenRouter providers (like this one), any `provider/model` slash prefix is stripped so the OpenAI API sees a flat ID.
- **Thinking config**: only built when `thinkingEnabled` is truthy; passed through to the provider's `chat()` method.
- **System prompt**: accepts `system_prompt`, `systemMessage`, or `systemPrompt`. Only prepended as a `SystemMessage` when non-empty (`is_valid_message_content`).
- **Error path**: any exception in the chat flow is caught, logged, and returned as `success=false` with `error: <str>`.

## Side Effects

- **Database writes**: none directly in the happy path. `_track_token_usage` (invoked elsewhere in the AI service when memory is attached) writes `TokenUsageMetric` rows; for a bare chat model node with no memory this path is typically not exercised from `execute_chat`.
- **Broadcasts**: none from `execute_chat` itself.
- **External API calls**: one HTTPS call to `https://api.openai.com/v1/chat/completions` via the `openai` Python SDK (base URL configured in `server/config/llm_defaults.json`; overridable via `{provider}_proxy` credential for Ollama-style routing).
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: `auth_service.get_api_key('openai', 'default')` (API key); optional `auth_service.get_api_key('openai_proxy')` for proxy URL override.
- **Services**: `AIService` (wired via `NodeExecutor.__init__`), `services/llm/providers/openai.py` (native provider).
- **Python packages**: `openai` (native SDK).
- **Environment variables**: none (keys are DB-stored).

## Edge cases & known limits

- **O-series fixed temperature**: `o1`, `o3`, `o3-mini`, `o4-mini` accept only `temperature=1`; `_resolve_temperature` (and its native counterpart) clamps regardless of input.
- **GPT-5 hybrid reasoning**: `reasoningEffort` (`minimal` / `low` / `medium` / `high`) is consumed via `NativeThinkingConfig.effort` and forwarded to the provider SDK. Without `thinkingEnabled=true` the effort value is ignored.
- **Reasoning summary availability**: the content of `thinking` for o-series models is gated on OpenAI org verification - unverified orgs get `thinking=null` even with `reasoningEffort` set.
- **`maxTokens` clamp**: clamped to the model's actual output ceiling by `native_resolve_max_tokens`. Exceeding the limit silently caps without error.
- **All errors are swallowed into the envelope**: any exception (HTTP, timeout, auth, JSON parse) becomes `success=false, error=str(e)`. The handler never raises.
- **No streaming**: `execute_chat` is single-shot; the full response is awaited before returning.
- **Pricing / token tracking**: standalone chat model nodes do NOT trigger `_track_token_usage` - that lives on the agent code paths. Cost attribution for bare chat-model executions is therefore not recorded.

## Related

- **Peer nodes** (same handler): [`anthropicChatModel`](./anthropicChatModel.md), [`geminiChatModel`](./geminiChatModel.md), [`openrouterChatModel`](./openrouterChatModel.md), [`groqChatModel`](./groqChatModel.md), [`cerebrasChatModel`](./cerebrasChatModel.md), [`deepseekChatModel`](./deepseekChatModel.md), [`kimiChatModel`](./kimiChatModel.md), [`mistralChatModel`](./mistralChatModel.md).
- **Architecture docs**: [Native LLM SDK](../../native_llm_sdk.md), [Credentials Encryption](../../credentials_encryption.md), [Pricing Service](../../pricing_service.md).
