# Cerebras Chat Model (`cerebrasChatModel`)

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

Ultra-fast inference on Cerebras' custom AI hardware. Models include Llama 3.1, GPT-OSS-120b, Qwen-3-235b. Shares `handle_ai_chat_model`. Like Groq, routes through the **LangChain fallback** (`is_native_provider('cerebras')` is False).

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | no | Upstream data; not consumed directly |

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `prompt` | string | `""` | yes | - | User message |
| `systemMessage` | string | `""` | no | - | System prompt |
| `model` | string | injected | no | - | e.g. `llama3.1-8b`, `gpt-oss-120b`, `qwen-3-235b-a22b` |
| `temperature` | number | 0-1.5 | no | - | Narrower range than OpenAI (0-1.5 rather than 0-2) |
| `maxTokens` | number | up to 8K | no | - | |
| `topP` | number | - | no | - | |
| `thinkingEnabled` | boolean | false | no | - | Only Qwen-3-235b supports format-based reasoning |
| `reasoningFormat` | options | `parsed` | no | `thinkingEnabled=[true]` | `parsed` / `hidden` - same semantics as Groq Qwen |
| `apiKey` | string | injected | no | - | `auth_service.get_api_key('cerebras', 'default')` |

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
  provider: 'cerebras';
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
  C --> D{valid key + prompt?}
  D -- no --> X[error envelope]
  D -- yes --> E[detect_ai_provider -> 'cerebras']
  E --> F[Strip 'owner/' prefix]
  F --> G[LangChain fallback path]
  G --> H[ChatOpenAI w/ base_url=api.cerebras.ai/v1]
  H --> I[invoke messages]
  I --> J[success envelope]
  H -- Exception --> X
```

## Decision Logic

- **Validation**: missing api_key / empty prompt -> error envelope.
- **Provider routing**: `detect_ai_provider` matches `'cerebras' in node_type.lower()` **before** the groq branch, so routing is unambiguous.
- **LangChain fallback**: `is_native_provider('cerebras')` False. Uses `ChatOpenAI` with Cerebras base_url.
- **Reasoning**: same parsed/hidden mechanism as Groq Qwen - only the Qwen-3-235b variant honors it.
- **Temperature range**: narrower (0-1.5 clamp) than OpenAI/Groq. `_resolve_temperature` applies the clamp.

## Side Effects

- **Database writes**: none on bare chat path.
- **Broadcasts**: none.
- **External API calls**: `POST https://api.cerebras.ai/v1/chat/completions` via LangChain `ChatOpenAI` with `base_url` override.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: `auth_service.get_api_key('cerebras', 'default')` plus optional `cerebras_proxy`.
- **Services**: `langchain_openai.ChatOpenAI`.
- **Python packages**: `langchain-openai`.
- **Environment variables**: none.

## Edge cases & known limits

- **LangChain path, not native** (same as Groq).
- **Temperature capped at 1.5**, not 2.
- **Reasoning only on Qwen-3-235b**.
- **Small max output**: 8K for most models; exceeding this surfaces as a provider-side error in the envelope.
- **Errors swallowed into envelope**.

## Related

- **Peer nodes**: see the other chat-model docs in this folder.
- **Architecture docs**: [Native LLM SDK](../../native_llm_sdk.md).
