# Event Waiter System

> **⚠️ Pre-Wave-11 — historical reference only.**
> Node authoring now happens on the backend: each node is a Python plugin under `server/nodes/<category>/<node>.py` that emits a `NodeSpec`. The frontend reads specs via [client/src/lib/nodeSpec.ts](../client/src/lib/nodeSpec.ts) + [adapters/nodeSpecToDescription.ts](../client/src/adapters/nodeSpecToDescription.ts). See [plugin_system.md](./plugin_system.md) and [server/nodes/README.md](../server/nodes/README.md) for the current model. The snippets below that reference `client/src/nodeDefinitions/*` are kept for historical context.

Trigger nodes in MachinaOS suspend workflow execution until an external event arrives (WhatsApp message, webhook request, Telegram message, chat input, delegated task completion, etc.). The Event Waiter system is the generic primitive that backs all push-based triggers. It has two backends: in-memory (`asyncio.Future`) and Redis Streams (for multi-worker durability).

Source file: `server/services/event_waiter.py`

## What It Solves

Before this system, each trigger had its own ad-hoc waiting code. That meant:

- No common cancel path
- No common filter semantics
- No way to persist waits across Temporal worker restarts
- No way to debug which triggers were active

A single waiter module replaces all of that. Adding a new trigger now means adding one entry to the registry and one filter builder.

## Core Concepts

### Waiter

A `Waiter` is a single subscription:

```python
@dataclass
class Waiter:
    id: str                          # UUID
    node_id: str                     # workflow node waiting
    node_type: str                   # 'whatsappReceive', 'webhookTrigger', ...
    event_type: str                  # 'whatsapp_message_received', ...
    params: Dict                     # node parameters (used to rebuild filter in Redis mode)
    filter_fn: Callable[[Dict], bool]
    future: Optional[asyncio.Future] # only used in memory mode
    cancelled: bool
    created_at: float
```

### Trigger Registry

Every event-based trigger node type is registered with the event name it listens for:

```python
TRIGGER_REGISTRY: Dict[str, TriggerConfig] = {
    'start':            TriggerConfig('start',            'deploy_triggered',         'Deploy Start'),
    'whatsappReceive':  TriggerConfig('whatsappReceive',  'whatsapp_message_received','WhatsApp Message'),
    'webhookTrigger':   TriggerConfig('webhookTrigger',   'webhook_received',         'Webhook Request'),
    'chatTrigger':      TriggerConfig('chatTrigger',      'chat_message_received',    'Chat Message'),
    'taskTrigger':      TriggerConfig('taskTrigger',      'task_completed',           'Task Completed'),
    'twitterReceive':   TriggerConfig('twitterReceive',   'twitter_event_received',   'Twitter Event'),
    'gmailReceive':     TriggerConfig('gmailReceive',     'gmail_email_received',     'Gmail Email'),
    'telegramReceive':  TriggerConfig('telegramReceive',  'telegram_message_received','Telegram Message'),
}
```

`cronScheduler` is **not** in this registry: it uses APScheduler directly and does not wait for events.

### Filter Builders

Each trigger type has a filter builder that reads the node's parameters once and returns a closure evaluated per event:

```python
FILTER_BUILDERS = {
    'whatsappReceive':  build_whatsapp_filter,
    'webhookTrigger':   build_webhook_filter,
    'chatTrigger':      build_chat_filter,
    'taskTrigger':      build_task_completed_filter,
    'twitterReceive':   build_twitter_filter,
    'gmailReceive':     build_gmail_filter,
    'telegramReceive':  build_telegram_filter,
}
```

Filter closures capture parameter values at registration time. For example, `build_whatsapp_filter` captures `messageTypeFilter`, `sender_filter`, `contact_phone`, `group_id`, `keywords`, `ignore_own`, and `forwarded_filter`, then returns a function that checks each incoming WhatsApp message against those constraints.

## Execution Flow

```
Deployment starts
        |
        v
Trigger node encountered in execution layer
        |
        v
event_waiter.register(node_type, node_id, params) -> Waiter
        |
        v
event_waiter.wait_for_event(waiter)  (suspends)
                    |
        External event arrives (WhatsApp RPC, Telegram long-polling, webhook HTTP request, ...)
                    |
                    v
        event_waiter.dispatch(event_type, data)  (sync, thread-safe)
        or event_waiter.dispatch_async(event_type, data)  (Redis mode)
                    |
                    v
        For each Waiter with matching event_type:
            if waiter.filter_fn(data):
                waiter.future.set_result(data)  (memory mode)
                or stream_ack(...)              (Redis mode)
                    |
                    v
Workflow resumes, trigger node completes, downstream nodes execute
```

## Two Backends

### Memory Mode

Default for local development. Uses `asyncio.Future` with a module-level `_waiters` dict.

- `register()` creates an `asyncio.Future` and stores it in `_waiters[waiter.id]`.
- `wait_for_event()` awaits the future.
- `dispatch()` iterates `_waiters`, runs `filter_fn(data)` on each, calls `future.set_result(data)` on matches.

Thread-safe: `dispatch()` detects whether it is running in an async loop or a thread (e.g. APScheduler callback) and uses `asyncio.run_coroutine_threadsafe(..., _main_loop)` when needed.

### Redis Streams Mode

Activated automatically when `CacheService.is_streams_available()` returns True. Used in Temporal multi-worker deployments where waiters may live on different processes than dispatchers.

- Events are appended to `events:{event_type}` streams via `XADD`.
- Each waiter creates its own consumer group `waiter_group_{waiter_id}` for broadcast semantics (every waiter sees every event, not load-balanced).
- `_wait_redis()` polls with blocking `XREADGROUP` in 5-second chunks so cancellation is responsive.
- On match, the stream entry is `XACK`ed and the waiter is cleaned up.
- Waiter metadata is stored in `waiters:{waiter_id}` with 24-hour TTL for visibility in other workers.

The Redis mode is initialized by `set_cache_service(cache)` during app startup in `main.py`.

## Polling Triggers vs Event Triggers

Some triggers do not fit the push model because the upstream service has no webhook or long-polling API. These use a different primitive in `TriggerManager`:

| Trigger Type | Mechanism | Location |
|---|---|---|
| `whatsappReceive` | Event (push) | `event_waiter.py` |
| `webhookTrigger` | Event (push via FastAPI router) | `event_waiter.py` |
| `chatTrigger` | Event (push via WebSocket) | `event_waiter.py` |
| `taskTrigger` | Event (push via delegation) | `event_waiter.py` |
| `telegramReceive` | Event (push via long-polling) | `event_waiter.py` + `TelegramService` |
| `twitterReceive` | **Polling** | `deployment/triggers.py` + `asyncio.Queue` |
| `gmailReceive` | **Polling** | `deployment/triggers.py` + `asyncio.Queue` |
| `cronScheduler` | APScheduler | `deployment/triggers.py` |

Polling triggers are routed in `DeploymentManager._create_poll_coroutine()` and use `TriggerManager.setup_polling_trigger()` with a custom poll function and an `asyncio.Queue`. See [workflow-schema.md](workflow-schema.md) for the full trigger list.

## Cancellation

Users can cancel a waiting trigger from the UI (Cancel button on the trigger node). The path:

1. Frontend sends `cancel_event_wait` WebSocket message with `waiter_id` or `node_id`.
2. `handle_cancel_event_wait()` in `server/routers/websocket.py` calls either `event_waiter.cancel(waiter_id)` or `event_waiter.cancel_for_node(node_id)`.
3. `cancel()` sets `w.cancelled = True`, calls `future.cancel()` in memory mode, and deletes the Redis metadata key in Redis mode.
4. The suspended `wait_for_event()` raises `asyncio.CancelledError`, which bubbles up through the node executor.

## Debugging

`event_waiter.get_active_waiters()` returns a list of all currently active waiters with age, backend mode, and done/cancelled status. The `get_active_waiters` WebSocket handler exposes this to the frontend for the active-triggers debug view.

```python
{
    "id": "uuid",
    "node_id": "whatsappReceive-1",
    "node_type": "whatsappReceive",
    "event_type": "whatsapp_message_received",
    "done": False,
    "cancelled": False,
    "age_seconds": 142.3,
    "mode": "redis"  # or "memory"
}
```

## Adding a New Trigger Type

1. **Register it** in `TRIGGER_REGISTRY`:

   ```python
   'mqttTrigger': TriggerConfig('mqttTrigger', 'mqtt_message_received', 'MQTT Message'),
   ```

2. **Build a filter** closure from node params and add it to `FILTER_BUILDERS`:

   ```python
   def build_mqtt_filter(params: Dict) -> Callable[[Dict], bool]:
       topic = params.get('topic', '')
       qos = params.get('qos', 0)

       def matches(m: Dict) -> bool:
           if topic and m.get('topic') != topic:
               return False
           if qos and m.get('qos') != qos:
               return False
           return True
       return matches

   FILTER_BUILDERS['mqttTrigger'] = build_mqtt_filter
   ```

3. **Dispatch events** from the external service:

   ```python
   from services import event_waiter
   event_waiter.dispatch('mqtt_message_received', {'topic': ..., 'payload': ...})
   ```

4. **Add the node definition** in `client/src/nodeDefinitions/` with `group: ['..., trigger']`.

5. **Add output schema** in `client/src/components/parameterPanel/InputSection.tsx` so downstream nodes can drag fields.

No changes are needed in the execution engine, cancel path, or deployment manager.

## Related Docs

- [DESIGN.md](DESIGN.md) - how triggers fit into execution
- [workflow-schema.md](workflow-schema.md) - trigger node catalog
- [TEMPORAL_ARCHITECTURE.md](TEMPORAL_ARCHITECTURE.md) - why Redis mode exists for Temporal workers
