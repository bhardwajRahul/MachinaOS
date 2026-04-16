# Social Receive (`socialReceive`)

| Field | Value |
|------|-------|
| **Category** | social |
| **Frontend definition** | [`client/src/nodeDefinitions/socialNodes.ts`](../../../client/src/nodeDefinitions/socialNodes.ts) |
| **Backend handler** | [`server/services/handlers/social.py::handle_social_receive`](../../../server/services/handlers/social.py) |
| **Tests** | [`server/tests/nodes/test_telegram_social.py`](../../../server/tests/nodes/test_telegram_social.py) |
| **Skill (if any)** | none |
| **Dual-purpose tool** | no |

## Purpose

Normalizes messages from any platform-specific trigger (WhatsApp, Telegram,
Chat, Webchat, Discord, Slack, ...) into the unified "inbound message" schema.
Applies channel / message-type / sender / keyword filters, then fans the
result out across four dedicated handles (`message`, `media`, `contact`,
`metadata`) so downstream agents can grab just the slice they need.

The dispatcher in `NodeExecutor._dispatch` special-cases `socialReceive`
(node_executor.py:367-374) to collect upstream outputs via
`_get_connected_outputs_with_info` and inject them as `outputs` / `source_nodes`.

## Inputs (handles)

| Handle | Connection type | Required | Purpose |
|--------|-----------------|----------|---------|
| `input-main` | main | yes | Upstream trigger output (`whatsappReceive`, `telegramReceive`, `chatTrigger`, ...) - this is what gets normalized |

The executor resolves upstream outputs keyed by source node **type**, so the
handler walks `source_nodes` and looks up `outputs[source_type]`.

## Parameters

| Name | Type | Default | Required | displayOptions.show | Description |
|------|------|---------|----------|---------------------|-------------|
| `channelFilter` | options | `all` | no | - | Only allow messages whose detected `channel` matches |
| `messageTypeFilter` | options | `all` | no | - | Filter by `message_type` |
| `senderFilter` | options | `all` | no | - | `all` / `any_contact` / `contact` / `group` / `keywords` |
| `contactPhone` | string | `""` | yes when `senderFilter=contact` | `senderFilter: ['contact']` | Exact phone compare |
| `groupId` | string | `""` | yes when `senderFilter=group` | `senderFilter: ['group']` | Exact chat_id compare |
| `keywords` | string | `""` | no | `senderFilter: ['keywords']` | Comma-separated, lower-case substring match |
| `ignoreOwnMessages` | boolean | `true` | no | - | Drop messages where `is_from_me=True` |
| `ignoreBots` | boolean | `false` | no | - | Drop messages where `is_bot=True` |

## Outputs (handles)

`NodeExecutor` stores the handler's `result.result` under `output_main`
**and** splits it into four additional output-store keys so different
downstream handles can consume different slices (node_executor.py:292-296):

| Handle / key | Shape | Description |
|--------------|-------|-------------|
| `output_main` | object | Full unified message (backwards-compatible) |
| `output_message` | string | `result.message` - plain text for LLM input |
| `output_media` | object | `result.media` - `{ url, type, mimetype, caption, size, thumbnail, filename }` (empty `{}` when no media) |
| `output_contact` | object | `result.contact` - `{ sender, sender_phone, sender_name, sender_username, channel, is_group, group_info, chat_title }` |
| `output_metadata` | object | `result.metadata` - `{ message_id, chat_id, timestamp, message_type, is_from_me, is_forwarded, reply_to, thread_id }` |

### Output payload (`result`)

```ts
{
  // Per-handle slices (also written to dedicated output keys):
  message: string;
  media: { url, type, mimetype, caption, size, thumbnail, filename } | {};
  contact: { sender, sender_phone, sender_name, sender_username, channel, is_group, group_info, chat_title };
  metadata: { message_id, chat_id, timestamp, message_type, is_from_me, is_forwarded, reply_to, thread_id };

  // Plus the full unified message at the top level (spread):
  message_id: string;
  channel: string;
  sender: string;
  sender_phone: string;
  sender_name: string;
  sender_username: string;
  chat_id: string;
  chat_title: string;
  chat_type: 'dm' | 'group' | string;
  message_type: string;
  text: string;
  timestamp: string;
  is_group: boolean;
  is_from_me: boolean;
  is_forwarded: boolean;
  is_bot: boolean;
  is_admin: boolean;
  thread_id?: any;
  account_id?: any;
  session_id?: any;
  group_info?: any;
  location?: any;
  contact?: any;
  poll?: any;
  reaction?: any;
  reply_to?: any;
  mentions?: any;
  raw: object;
}
```

When a message is filtered out the handler returns
`{ success: true, result: null, filtered: true, reason: "Message did not pass filters" }`.

## Logic Flow

```mermaid
flowchart TD
  A[_dispatch specialcase] --> A1[_get_connected_outputs_with_info]
  A1 --> B[handle_social_receive]
  B --> C[Scan source_nodes,<br/>pick first output with<br/>message_id / text / message]
  C -- none --> C2[Fallback: iterate outputs dict]
  C2 -- still none --> Efail[Return success=false<br/>error: No message data]
  C -- found --> D[Detect source_channel from node type<br/>or output.channel / sender suffix]
  C2 -- found --> D
  D --> E[_normalize_to_unified_format]
  E --> F{_apply_filters}
  F -- fail --> Ffilt[Return success=true<br/>result=null, filtered=true]
  F -- pass --> G[Build 4-slice result dict +<br/>spread full unified message]
  G --> H[Return success=true]

  subgraph Executor post-processing
    H --> H1[output_main = result]
    H1 --> H2[output_message = result.message]
    H2 --> H3[output_media = result.media]
    H3 --> H4[output_contact = result.contact]
    H4 --> H5[output_metadata = result.metadata]
  end
```

## Decision Logic

- **Source resolution (primary path)**: Loop over `source_nodes`, look up
  `outputs[source_type]`, accept the first dict that has any of
  `message_id` / `text` / `message`.
- **Source resolution (fallback)**: If the primary path fails, iterate
  `outputs.items()` and apply the same detection. Channel detection here also
  sniffs `sender.endswith('@s.whatsapp.net')` to tag WhatsApp.
- **Channel detection** (case-insensitive substring on node type or key):
  `whatsapp`/`telegram`/`discord`/`slack`/`chat` (-> `webchat`). Falls back to
  `output.channel` if present, else `"unknown"`.
- **Chat type**: `_determine_chat_type` returns `data.chat_type` if set, else
  `"group"` if `is_group` else `"dm"`.
- **Filters** (`_apply_filters`):
  - `channelFilter`: exact match against normalized `channel`.
  - `messageTypeFilter`: exact match against `message_type`.
  - `senderFilter=any_contact`: rejects group messages only.
  - `senderFilter=contact`: rejects when `sender_phone != contactPhone` (only
    if `contactPhone` is truthy).
  - `senderFilter=group`: rejects when `chat_id != groupId` (only if `groupId` is truthy).
  - `senderFilter=keywords`: lower-cased substring match on the `text`; empty
    `keywords` accepts all.
  - `ignoreOwnMessages` (default `true`): drops `is_from_me`.
  - `ignoreBots`: drops `is_bot`.
- **Message id synthesis**: If upstream omits `message_id`, a random 8-char
  hex (`uuid4().hex[:8]`) is assigned.
- **Webchat defaults**: When `source_channel == 'webchat'`, missing `sender` is
  set to `webchat_<session_id>`, `chat_id` defaults to the session id, and
  `sender_name` defaults to `"User"`.

## Side Effects

- **Database writes**: none.
- **Broadcasts**: none from the handler; executor writes the five output-store
  keys.
- **External API calls**: none.
- **File I/O**: none.
- **Subprocess**: none.

## External Dependencies

- **Credentials**: none.
- **Services**: none directly; relies on upstream trigger nodes feeding
  `outputs` via the executor.
- **Python packages**: stdlib only (`uuid`, `time`, `datetime`, `typing`).
- **Environment variables**: none.

## Edge cases & known limits

- **First-match wins**: When multiple upstream triggers feed `socialReceive`
  in the same execution, only the first candidate (by `source_nodes` iteration
  order) is normalized; the others are silently ignored.
- **Channel heuristic is fragile**: Detection uses `.lower() in source_type`
  and `sender.endswith('@s.whatsapp.net')`. A node type named `chatty_*`
  becomes `webchat`, and a Telegram message without a matching node type
  falls back to `"unknown"`.
- **Filtered messages still succeed**: When filters reject a message, the
  envelope is `success=true, result=null, filtered=true`. Downstream nodes
  receive `null` via the output store - anything that expects a dict must
  handle this.
- **`_apply_filters` default for `ignoreOwnMessages` is `True`**: Loopback
  messages (echo bots, self-tests) are silently dropped unless explicitly
  turned off in the UI.
- **Top-level spread**: `{ ...unified_message }` overwrites the dedicated
  `contact` / `media` keys the handler just built, with the raw versions from
  the upstream message. Code that reads `result.contact` via the output-store
  key `output_contact` sees the handler's structured slice; code that reads
  `result['contact']` from `output_main` may see the upstream raw contact
  dict instead (they are not the same shape).
- **UUID `message_id` on fallback**: Not cryptographically unique across
  sessions; two workflows receiving chatTrigger messages at the same time
  can generate colliding ids.
- **`source_nodes` parameter typo risk**: Handler accepts `outputs=None` and
  `source_nodes=None` and falls back to `context['outputs']` / `[]` - useful
  for direct unit tests but also means a broken executor path would silently
  return "No message data received" instead of failing fast.

## Related

- **Sibling nodes**: [`socialSend`](./socialSend.md), [`telegramReceive`](./telegramReceive.md)
- **Upstream triggers**: [`telegramReceive`](./telegramReceive.md); WhatsApp/Chat triggers live in other categories
- **Dispatcher special-case**: `server/services/node_executor.py:287-296, 367-374`
