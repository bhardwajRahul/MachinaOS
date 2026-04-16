# OpenRouter Chat Model (`openrouterChatModel`)

| Field | Value |
|------|-------|
| **Category** | ai_chat_models |
| **Frontend definition** | [`client/src/nodeDefinitions/aiModelNodes.ts`](../../../client/src/nodeDefinitions/aiModelNodes.ts) |
| **Backend handler** | [`server/services/handlers/ai.py::handle_ai_chat_model`](../../../server/services/handlers/ai.py) |
| **AI service** | [`server/services/ai.py::AIService.execute_chat`](../../../server/services/ai.py) |
| **Tests** | [`server/tests/nodes/test_ai_chat_models.py`](../../../server/tests/nodes/test_ai_chat_models.py) |
| **Skill (if any)** | n/a |
| **Dual-purpose tool** | no |

## Purpose

Unified access to 200+ models from multiple providers (OpenAI, Anthropic, Google, Meta, Mistral, etc.) through a single OpenAI-compatible API. Shares the common `handle_ai_chat_model` handler.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream data; not consumed directly |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `prompt` | string | `""` | yes (non-empty) | - | User message |
| `systemMessage` | string | `""` | no | - | System prompt |
| `model` | string | injected | no | - | `provider/model-id` format, e.g. `anthropic/claude-opus-4.6`, `openai/gpt-4o`. `[FREE] ` prefix stripped before the API call but the prefix IS preserved for the dropdown grouping |
| `temperature` | number | 0-2 | no | - | |
| `maxTokens` | number | varies per model | no | - | |
| `topP` | number | - | no | - | |
| `frequencyPenalty` | number | 0 | no | - | Forwarded to downstream provider |
| `presencePenalty` | number | 0 | no | - | Forwarded |
| `thinkingEnabled` | boolean | false | no | - | Only honored if the routed model supports it |
| `thinkingBudget` | number | 2048 | no | `thinkingEnabled=[true]` | |
| `reasoningEffort` | options | `medium` | no | `thinkingEnabled=[true]` | |
| `apiKey` | string | injected | no | - | `auth_service.get_api_key('openrouter', 'default')` |

## Outputs (handles)

| Handle | Shape | Description |
|--------|-------|-------------|
| `output-main` | object | Standard envelope payload |

### Output payload

```ts
{
  response: string;
  thinking: string | null;
  thinking_enabled: boolean;
  model: string;
  provider: 'openrouter';
  finish_reason: string;
  timestamp: string;
  input: { prompt: string; system_prompt: string };
}
```

## Logic Flow

```mermaid
flowchart TD
  A[NodeExecutor dispatch] --> B[handle_ai_chat_model]
  B --> C[AIService.execute_chat]
  C --> D[Strip '[FREE] ' prefix from model]
  D --> E{valid key + prompt?}
  E -- no --> X[error envelope]
  E -- yes --> F[detect_ai_provider -> 'openrouter']
  F --> G[DO NOT strip 'owner/' prefix<br/>provider == openrouter]
  G --> H[Native path: create_provider openrouter<br/>OpenAI SDK w/ base_url=openrouter.ai/api/v1]
  H --> I[provider.chat -> response]
  I --> J[success envelope]
  H -- Exception --> X
```

## Decision Logic

- **Validation**: missing api_key / empty prompt -> error envelope.
- **Provider routing**: matches `'openrouter' in node_type.lower()` in `detect_ai_provider` BEFORE the `anthropic`/`gemini` branches, so model IDs like `anthropic/claude-3.5-sonnet` stay in the OpenRouter lane.
- **Model string rule (important)**: for OpenRouter, the `owner/model` slash-prefix is **kept** (the API expects it). For every other provider the prefix is stripped. See `execute_chat` line: `if provider != 'openrouter' and '/' in model: model = model.split('/', 1)[-1]`.
- **[FREE] prefix**: stripped unconditionally before the API call; exists only for the frontend dropdown grouping.
- **Native provider**: OpenAI SDK reused with `base_url` set to the OpenRouter gateway; `OpenRouterProvider` inherits from `OpenAIProvider`.

## Side Effects

- **Database writes**: none on bare chat path.
- **Broadcasts**: none.
- **External API calls**: `POST https://openrouter.ai/api/v1/chat/completions` via `openai` SDK with overridden `base_url`. Requires `HTTP-Referer` and `X-Title` headers (set by `OpenRouterProvider`).
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: `auth_service.get_api_key('openrouter', 'default')` plus optional `openrouter_proxy`.
- **Services**: `services/llm/providers/openrouter.py`.
- **Python packages**: `openai`.
- **Environment variables**: none.

## Edge cases & known limits

- **200+ models, varying capabilities**: thinking support, context windows, temperature ranges, and pricing all vary per routed model. The handler applies generic clamps; mismatches surface as envelope errors from the downstream provider (e.g. "This model does not support the reasoning parameter").
- **`[FREE] ` models are OpenRouter-free but may still cost latency**: routing can queue against capacity.
- **`owner/model` prefix is load-bearing**: removing it breaks routing. Unique among the 9 chat models.
- **Errors swallowed into envelope**.

## Related

- **Peer nodes**: see the other chat-model docs in this folder.
- **Architecture docs**: [Native LLM SDK](../../native_llm_sdk.md).
