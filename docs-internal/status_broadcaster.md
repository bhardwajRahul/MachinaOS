# WebSocket Status Broadcaster

MachinaOS uses WebSocket as the primary communication channel between the React frontend and the FastAPI backend. A single `StatusBroadcaster` service manages all active WebSocket connections and broadcasts real-time state updates (node status, workflow progress, Android device status, variable changes, etc.). This replaces REST polling with push-based updates and is the reason the UI can animate node execution, show live tool calls, and update Android status without reloading.

This document covers the broadcaster architecture, the 89 WebSocket message handlers, the broadcast message types, and the Android two-state connection model.

Source files:
- `server/services/status_broadcaster.py` - `StatusBroadcaster` singleton
- `server/routers/websocket.py` - WebSocket endpoint and 89 message handlers
- `client/src/contexts/WebSocketContext.tsx` - frontend WebSocket provider with hooks

## Why WebSocket-First

Early iterations of MachinaOS used REST endpoints for most frontend-backend operations. That caused three recurring problems:

1. **Polling noise**: the frontend had to re-fetch parameters, workflows, Android status, and node outputs on an interval to look "live".
2. **No push**: node execution status changes (running, completed, errored) could not reach the UI without polling; tool calls during agent execution were invisible until the whole agent finished.
3. **Latency**: fetch -> parse -> re-render cycles added 100-200ms to every user action.

Moving all frontend-backend traffic to a single WebSocket connection eliminated polling, enabled real-time status animations, and simplified authentication (one handshake, one cookie check).

## Architecture

```
React UI (WebSocketContext.tsx)
        |
        | ws://host/ws/status (single persistent connection)
        v
FastAPI /ws/status endpoint (server/routers/websocket.py)
        |
        v
StatusBroadcaster (server/services/status_broadcaster.py)
        |
        +-- connection set: Set[WebSocket]
        +-- current status: Dict[str, Any]
        |     |-- android: {connected, paired, device_id, ...}
        |     |-- nodes: {node_id: {status, output, error, ...}}
        |     |-- variables: {name: value}
        |     `-- workflow: {executing, current_node, progress}
        |
        +-- connect(ws)        -> accept + send initial_status
        +-- disconnect(ws)     -> remove from set
        +-- update_*(...)      -> mutate state + _broadcast()
        +-- _broadcast(msg)    -> fan out to all connected clients
```

## Connection Lifecycle

```
Frontend mounts <WebSocketProvider>
        |
        v
WebSocket connects to /ws/status
        |
        v
Backend middleware checks JWT cookie (if auth enabled)
        |
        +-- invalid --> close(4001, "Not authenticated")
        |
        v
StatusBroadcaster.connect(ws)
        |
        +-- accept
        +-- add to _connections
        `-- send {"type": "initial_status", "data": current_status}
        |
        v
Message loop:
  receive_json -> dispatch to handler in _HANDLERS registry
  send_json    -> pushed by broadcaster on state change
  ping/pong    -> keepalive every 30s from frontend
        |
        v
Frontend unmounts or logs out
        |
        v
StatusBroadcaster.disconnect(ws) -> remove from _connections
```

Auto-reconnect is handled by `WebSocketContext.tsx`: on disconnect, it schedules a reconnect after 3 seconds with a 100ms mount delay to avoid React Strict Mode double-connect in dev.

## Handler Registry

Handlers are registered via the `@ws_handler` decorator:

```python
@ws_handler()
async def handle_get_node_parameters(data: Dict, websocket: WebSocket) -> Dict:
    node_id = data.get("node_id")
    params = await database.get_node_parameters(node_id)
    return {"success": True, "parameters": params}
```

The decorator populates a module-level `_HANDLERS: Dict[str, Callable]` map from the function name (`handle_get_node_parameters` -> `"get_node_parameters"`). The dispatcher reads the incoming message's `type` field and looks up the handler.

Current total: **89 WebSocket handlers** in `server/routers/websocket.py`.

### Handler Categories

| Category | Example handlers |
|---|---|
| Status / ping | `ping`, `get_status`, `get_android_status`, `get_node_status`, `get_variable` |
| Node parameters | `get_node_parameters`, `save_node_parameters`, `delete_node_parameters`, `get_all_node_parameters` |
| Tool schemas | `get_tool_schema`, `save_tool_schema`, `delete_tool_schema`, `get_all_tool_schemas` |
| Node execution | `execute_node`, `execute_workflow`, `cancel_execution`, `get_node_output`, `clear_node_output` |
| Triggers / events | `cancel_event_wait`, `get_active_waiters` |
| Dead letter queue | `get_dlq_entries`, `replay_dlq_entry`, `remove_dlq_entry`, `purge_dlq`, `get_dlq_stats` |
| Deployment | `deploy_workflow`, `cancel_deployment`, `get_deployment_status`, `update_deployment_settings` |
| AI operations | `execute_ai_node`, `get_ai_models`, `test_ai_proxy` |
| API keys | `validate_api_key`, `get_stored_api_key`, `save_api_key`, `delete_api_key` |
| OAuth flows | `claude_oauth_login`, `twitter_oauth_login`, `twitter_logout`, `google_oauth_login`, `google_logout` |
| Android | `get_android_devices`, `execute_android_action`, `android_relay_connect`, `android_relay_disconnect`, `android_relay_reconnect` |
| WhatsApp | `whatsapp_status`, `whatsapp_qr`, `whatsapp_send`, `whatsapp_chat_history`, `whatsapp_newsletters`, `whatsapp_diagnostics`, ... |
| Telegram | `telegram_connect`, `telegram_disconnect`, `telegram_status`, `telegram_send`, `telegram_get_me`, `telegram_get_chat` |
| Workflow storage | `save_workflow`, `get_workflow`, `get_all_workflows`, `delete_workflow` |
| Chat messages | `send_chat_message`, `get_chat_messages`, `clear_chat_messages`, `get_chat_sessions` |
| Console / terminal | `get_console_logs`, `clear_console_logs`, `get_terminal_logs`, `clear_terminal_logs` |
| Skills | `get_skill_content`, `save_skill_content`, `get_user_skills`, `create_user_skill`, `scan_skill_folder` |
| Memory | `clear_memory`, `reset_skill`, `configure_compaction`, `get_compaction_stats` |
| User settings | `get_user_settings`, `save_user_settings`, `get_provider_defaults`, `save_provider_defaults` |
| Pricing / usage | `get_pricing_config`, `save_pricing_config`, `get_api_usage_summary`, `get_provider_usage_summary` |
| Agent teams | `create_team`, `add_team_task`, `claim_team_task`, `complete_team_task`, `get_team_messages` |
| Model registry | `get_model_constraints`, `refresh_model_registry` |

The exact set drifts over time. The canonical count comes from counting `@ws_handler(` occurrences in `server/routers/websocket.py`.

## Broadcast Messages (Server -> Clients)

Broadcasts are sent to all connected clients without a request-response correlation. They fire on state changes in the backend:

| Message Type | Trigger | Payload |
|---|---|---|
| `android_status` | Android relay connect/disconnect/pair | `{connected, paired, device_id, device_name, connection_type, qr_data, ...}` |
| `node_status` | Node enters executing / waiting / success / error | `{node_id, status, data, workflow_id, timestamp}` |
| `node_output` | Node produces output | `{node_id, output, workflow_id}` |
| `variable_update` | Single variable changes | `{name, value}` |
| `variables_update` | Batch variable update | `{variables: Dict}` |
| `workflow_status` | Workflow start / progress / complete | `{executing, current_node, progress}` |
| `api_key_status` | Credential validation result | `{provider, valid, models}` |
| `node_parameters_updated` | Parameters saved by another client | `{node_id, parameters}` |
| `token_usage_update` | AI execution updates token counters | `{session_id, data: {total, threshold, needs_compaction}}` |
| `compaction_starting` | Memory compaction begins | `{session_id, node_id}` |
| `compaction_completed` | Memory compaction ends | `{session_id, success, tokens_before, tokens_after}` |

## Android Two-State Connection Model

Android support uses a two-state model because a relay WebSocket can be connected without a device being paired. The UI needs both signals.

| State | Meaning | Frontend behavior |
|---|---|---|
| `connected` | Relay WebSocket to `wss://relay.zeenie.xyz/ws` is active | Not shown directly |
| `paired` | Android app has scanned QR and established session | Green dot on Android nodes |

```
User clicks Connect
        |
        v
Relay WebSocket opens --> broadcast_connected({connected: true, paired: false})
        |                                   QR code shown
        v
User scans QR with Android app
        |
        v
Device pairs            --> broadcast_connected({connected: true, paired: true, device_id, device_name})
        |                                   Green dot lights up
        v
App disconnects         --> broadcast_device_disconnected({connected: true, paired: false, qr_data, session_token})
        |                                   QR shown again for re-pairing
        v
Relay WebSocket closes  --> broadcast_relay_disconnected({connected: false, paired: false})
```

Android service nodes (`batteryMonitor`, `wifiAutomation`, etc.) check `androidStatus.paired` (not `connected`) before allowing execution. See `client/src/components/SquareNode.tsx`.

## Auto-Reconnect and Ping Keepalive

**Frontend** (`WebSocketContext.tsx`):

- 30-second `setInterval` sends `{"type": "ping"}`.
- On disconnect: schedule reconnect after 3 seconds.
- 100ms mount delay avoids React Strict Mode double-connect in development.
- `isMountedRef` prevents connections after unmount.
- WebSocket is gated on `isAuthenticated` from `AuthContext`: if auth is disabled or not yet loaded, the provider defers connection.

**Backend** (`websocket.py`):

- Responds to `ping` with `{"type": "pong"}`.
- On `get_status`, returns the full current status snapshot.
- On disconnect, removes the WebSocket from `StatusBroadcaster._connections`.

## Error Handling

All handlers use a try/except wrapper that returns a structured error response instead of killing the WebSocket:

```python
try:
    result = await handler(data, websocket)
    await websocket.send_json({"type": response_type, **result})
except Exception as e:
    logger.error(f"Handler {handler_name} failed: {e}")
    await websocket.send_json({
        "type": "error",
        "handler": handler_name,
        "code": type(e).__name__,
        "message": str(e)
    })
```

The frontend matches responses by a `request_id` field (set by the frontend, echoed by the backend) to resolve pending promises in `WebSocketContext`.

## Related Docs

- [DESIGN.md](DESIGN.md) - overall backend architecture
- [credentials_encryption.md](credentials_encryption.md) - credential handlers that go through this layer
- [event_waiter_system.md](event_waiter_system.md) - `cancel_event_wait` and `get_active_waiters` handlers
- [memory_compaction.md](memory_compaction.md) - token usage broadcast messages
