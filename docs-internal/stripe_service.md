# Stripe Service

Stripe integration via the official [Stripe CLI](https://stripe.com/docs/stripe-cli).
Two workflow nodes:

- **`stripeAction`** (dual-purpose ActionNode + AI tool) — runs any
  `stripe …` command via subprocess and returns parsed JSON.
- **`stripeReceive`** (TriggerNode) — fires when `stripe listen`
  forwards a webhook event to MachinaOs at `/webhook/stripe`.

Stripe is the reference implementation of the Wave 12 event framework
documented in [Plugin System → Wave 12](./plugin_system.md#wave-12--generalized-event-framework-servicesevents).
Most of the heavy lifting (HMAC signature verification, daemon
supervision, lifecycle WebSocket handlers, status broadcasts, CLI
invocation) lives in [`services/events/`](../server/services/events/) —
this folder contributes only the Stripe-specific shapes.

## Architecture

```
                ┌────────────────────────────────────────────────────┐
                │              services/events/                      │
                │  WorkflowEvent, EventSource, WebhookTriggerNode,   │
                │  DaemonEventSource, StripeVerifier, run_cli_command│
                │  make_lifecycle_handlers, make_status_refresh      │
                └──────────────────────┬─────────────────────────────┘
                                       │ subclassed by
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ StripeListenSrc  │         │ StripeWebhookSrc │         │ StripeAction     │
│ (DaemonEvent     │         │ (WebhookSource)  │         │ Node             │
│  Source)         │         │                  │         │ (ActionNode      │
│                  │         │  path = "stripe" │         │  + AI tool)      │
│ supervises       │         │  verifier =      │         │                  │
│ `stripe listen`  │         │    StripeVerifier│         │ runs any         │
│ via              │         │  shape() →       │         │ `stripe ...`     │
│ ProcessService   │         │  WorkflowEvent   │         │ via              │
│                  │         │                  │         │ run_cli_command  │
│ captures whsec_  │         └──────────────────┘         └──────────────────┘
│ from stderr      │                  ▲                            ▲
│ banner           │                  │                            │
└──────────────────┘                  │                            │
        ▲                             │                            │
        │ start/stop/status           │ POST /webhook/stripe       │ subprocess
        │                             │                            │
   stripe CLI subprocess         stripe listen ──forwards─▶ MachinaOs
   (long-lived daemon)           (running daemon writes to localhost)
```

### Request flow — incoming webhook event

```
Stripe (cloud)
   │ event fires
   ▼
stripe listen (local daemon, supervised by StripeListenSource)
   │ forwards to --forward-to URL with Stripe-Signature header
   ▼
POST http://localhost:{port}/webhook/stripe
   │
   ▼
routers/webhook.py:handle_webhook
   │ if path in WEBHOOK_SOURCES → delegate
   ▼
StripeWebhookSource.handle(request)
   │
   ├── verifier.verify(headers, body, secret)
   │      Stripe-Signature: t=<ts>,v1=<hmac>
   │      raises ValueError → HTTPException(400)
   │
   ├── shape(request, body, payload)
   │      → WorkflowEvent(id=evt_…, type="stripe.charge.succeeded",
   │                      source="stripe://acct_…", data=payload)
   │
   └── event_waiter.dispatch(source.type, event)
          ▼
   StripeReceiveNode waiters resolved
   (WebhookTriggerNode.execute returns the shaped event)
```

### Request flow — outgoing CLI action

```
StripeActionNode.run(params)
   │ params.command = "customers create --email a@b.com"
   ▼
shlex.split(command)
   │ → ["customers", "create", "--email", "a@b.com"]
   ▼
run_cli_command(binary="stripe", argv=…, credential=StripeCredential)
   │
   ├── StripeCredential.resolve() → {"api_key": "sk_test_…", …}
   ├── shutil.which("stripe") → resolves binary on PATH
   ├── asyncio.create_subprocess_exec(
   │       binary, *argv, "--api-key", api_key,
   │       stdout=PIPE, stderr=PIPE,
   │   )
   ├── asyncio.wait_for(proc.communicate(), timeout=30.0)
   ├── json.loads(stdout) on success
   ▼
{"success": True, "result": {...}, "stdout": "..."}
```

### Daemon lifecycle

```
WS message: stripe_connect
   │
   ▼
StripeListenSource.start()  (lock-protected, idempotent)
   │
   ├── StripeCredential.resolve() → secrets
   ├── shutil.which("stripe") → fail fast if not installed
   ├── ProcessService.start(
   │       name="stripe-listen",
   │       command="stripe listen --forward-to http://localhost:{port}/webhook/stripe
   │                              --print-secret --api-key sk_test_…",
   │       workflow_id="_stripe_global",
   │       working_directory={workspace}/_stripe,
   │   )
   │
   ├── spawn _capture_secret task
   │      tails {cwd}/.processes/stripe-listen/stderr.log
   │      regex: r"whsec_[A-Za-z0-9_]+"
   │      on match: auth_service.store_api_key("stripe_webhook_secret", …)
   │
   └── _broadcast_status() → broadcaster._status["stripe"] + WS broadcast

WS message: stripe_disconnect
   ▼
StripeListenSource.stop()
   ├── cancel capture task
   ├── ProcessService.stop("stripe-listen", "_stripe_global")
   └── _broadcast_status()
```

## Key Files

| File | Description |
|---|---|
| `server/nodes/stripe/__init__.py` | Wiring: 5 `register_*` calls + `make_status_refresh`. |
| `server/nodes/stripe/_credentials.py` | `StripeCredential(ApiKeyCredential)` declaring the `stripe_api_key` secret + `stripe_webhook_secret` extra field. |
| `server/nodes/stripe/_source.py` | `StripeListenSource(DaemonEventSource)` and `StripeWebhookSource(WebhookSource)` plus their singletons. |
| `server/nodes/stripe/_handlers.py` | WS handlers via `make_lifecycle_handlers`; the only plugin-specific handler is `stripe_trigger` (synthetic test events). |
| `server/nodes/stripe/stripe_action.py` | `StripeActionNode` — pass-through over the CLI via `run_cli_command`. |
| `server/nodes/stripe/stripe_receive.py` | `StripeReceiveNode(WebhookTriggerNode)` — filter overrides + output reshape. |
| `server/services/events/__init__.py` | Public framework surface — exports every base class + helper. |
| `server/services/events/daemon.py` | `DaemonEventSource` — supervises subprocess via `ProcessService`, tails logs. |
| `server/services/events/webhook.py` | `WebhookSource` + `WEBHOOK_SOURCES` registry + `register_webhook_source`. |
| `server/services/events/triggers.py` | `WebhookTriggerNode` + `BaseTriggerParams`. |
| `server/services/events/cli.py` | `run_cli_command` helper. |
| `server/services/events/lifecycle.py` | `make_lifecycle_handlers` + `make_status_refresh`. |
| `server/services/events/verifiers/stripe.py` | `StripeVerifier` (`t=…,v1=…` HMAC-SHA256). |
| `server/routers/webhook.py` | Path-handler arm: consults `WEBHOOK_SOURCES` before falling through to legacy generic dispatch. |
| `server/nodes/visuals.json` | `stripeAction` / `stripeReceive` icon + color (`asset:stripe`, `#635BFF`). |
| `server/nodes/groups.py` | `payments` palette group. |
| `client/src/assets/icons/stripe.svg` | Stripe icon. |
| `server/tests/services/test_events.py` | 18 framework tests (envelope, verifiers, polling/daemon lifecycle, WebhookSource). |
| `server/tests/nodes/test_stripe_plugin.py` | 21 Stripe-specific tests (shape, filter, action passthrough, registrations). |

## Plugin classes

### `StripeCredential`

```python
class StripeCredential(ApiKeyCredential):
    id = "stripe_api_key"
    display_name = "Stripe"
    category = "Payments"
    icon = "asset:stripe"
    key_name = ""                                    # CLI takes the key via --api-key, not a header
    extra_fields = ("stripe_webhook_secret",)        # captured from CLI banner
    docs_url = "https://stripe.com/docs/cli"
```

Storage:

| Key | Type | Origin | Purpose |
|---|---|---|---|
| `stripe_api_key` | API key | User pastes from Stripe Dashboard → Developers → API keys | Authenticates every CLI invocation. Use a **restricted key** (Stripe → API keys → Create restricted key) with the minimum scopes you need. |
| `stripe_webhook_secret` | API key (extra field) | Auto-captured by `StripeListenSource._capture_secret` from the CLI's stderr banner | Verifies forwarded webhook signatures via `StripeVerifier`. Stable across daemon restarts; the CLI re-uses the same secret for the same MachinaOs install. |

### `StripeListenSource(DaemonEventSource)`

Supervises `stripe listen` as a long-lived process. Inherits the
full `DaemonEventSource` lifecycle (start / stop / restart / status /
log tailing). The Stripe-specific overrides are minimal:

| Method / attr | Purpose |
|---|---|
| `process_name = "stripe-listen"` | Key used by `ProcessService` to track this daemon. |
| `binary_name = "stripe"` | Resolved via `shutil.which`; surfaces a clear "not installed" error. |
| `workflow_namespace = "_stripe"` | The `ProcessService` workflow id and working dir under `{workspace_base}/_stripe`. |
| `install_hint` | Surfaced in the "binary not on PATH" error. |
| `credential = StripeCredential` | Resolved by the framework before `build_command` is called. |
| `build_command(secrets)` | Returns the `stripe listen --forward-to … --print-secret --api-key …` command string. |
| `parse_line(stream, line)` | On each stderr line, regex-matches `whsec_…`; on first match, persists the secret via `auth_service.store_api_key("stripe_webhook_secret", …)`. The Stripe daemon doesn't emit events itself — events arrive via the webhook receiver. |

### `StripeWebhookSource(WebhookSource)`

Receives forwarded events at `/webhook/stripe`. The framework owns
signature verification, JSON parsing, and `event_waiter.dispatch`;
this class declares only the path, the verifier, the secret-field
name, and the payload-to-`WorkflowEvent` shaping:

```python
class StripeWebhookSource(WebhookSource):
    type = "stripe.webhook"
    path = "stripe"
    verifier = StripeVerifier
    secret_field = "stripe_webhook_secret"
    credential = StripeCredential

    async def shape(self, request, body, payload) -> WorkflowEvent:
        created = payload.get("created")
        time = (
            datetime.fromtimestamp(int(created), tz=timezone.utc)
            if created else datetime.now(timezone.utc)
        )
        account = payload.get("account") or "default"
        return WorkflowEvent(
            id=payload.get("id") or "",          # provider event id (replay safety)
            type=f"stripe.{payload.get('type', 'unknown')}",
            source=f"stripe://{account}",
            time=time,
            data=payload,
            subject=payload.get("type"),
        )
```

The `id` mirrors Stripe's `evt_…` so duplicate deliveries (Stripe
retries on 5xx) are idempotent at the WorkflowEvent level.

### `StripeReceiveNode(WebhookTriggerNode)`

```python
class StripeReceiveParams(BaseTriggerParams):
    livemode_filter: Literal["all", "test", "live"] = "all"


class StripeReceiveNode(WebhookTriggerNode):
    type = "stripeReceive"
    display_name = "Stripe Receive"
    subtitle = "Webhook Event"
    group = ("payments", "trigger")
    handles = (
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    credentials = (StripeCredential,)
    webhook_source = StripeWebhookSource
    event_type_prefix = "stripe."                     # users write "charge.*" not "stripe.charge.*"
    Params = StripeReceiveParams
    Output = StripeReceiveOutput

    async def _check_precondition(self) -> Optional[str]:
        # Refuse to register a waiter if the daemon isn't running.
        ...

    def _extra_filter(self, params):                 # livemode filter on top of event-type
        ...

    def shape_output(self, event: WorkflowEvent) -> Dict:
        # Extract Stripe-shaped fields from the WorkflowEvent's CloudEvents data.
        ...
```

The framework's `WebhookTriggerNode` handles event-type glob matching
(`charge.*`, `payment_intent.*`, `all`), the
`event_type_prefix` auto-prepend, the `_check_precondition`
short-circuit, and the `Operation("wait")` stub. This class only
contributes the livemode filter and the output reshape.

### `StripeActionNode(ActionNode)` — dual-purpose

```python
class StripeActionParams(BaseModel):
    command: str = Field(default="", description=...)


class StripeActionOutput(BaseModel):
    command: Optional[str] = None
    success: Optional[bool] = None
    result: Optional[Any] = None
    stdout: Optional[str] = None
    error: Optional[str] = None


class StripeActionNode(ActionNode):
    type = "stripeAction"
    group = ("payments", "tool")
    credentials = (StripeCredential,)
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    @Operation("run", cost={"service": "stripe", "action": "run", "count": 1})
    async def run(self, ctx, params):
        cmd = params.command.strip()
        if not cmd:
            raise RuntimeError("command is required")
        result = await run_cli_command(
            binary="stripe", argv=shlex.split(cmd), credential=StripeCredential,
        )
        if not result["success"]:
            raise RuntimeError(result.get("error") or "Stripe CLI invocation failed")
        return {
            "command": cmd, "success": True,
            "result": result.get("result"), "stdout": result.get("stdout"),
        }
```

The CLI does its own argument parsing, validation, and error
messages. We don't re-implement per-resource operations — the user
(or LLM) types the command exactly as they would after `stripe `:

| Example command | What it does |
|---|---|
| `customers create --email a@b.com --name "Acme Inc"` | Create a Stripe customer |
| `customers list --limit 10` | List recent customers |
| `payment_intents create --amount 2000 --currency usd --customer cus_…` | Create a PaymentIntent |
| `refunds create --payment-intent pi_…` | Refund a PaymentIntent |
| `charges retrieve ch_…` | Fetch a charge |
| `trigger charge.succeeded` | Fire a synthetic test event (also exposed via the `stripe_trigger` WebSocket handler) |

All Stripe CLI commands are supported automatically; future Stripe
resources work without code changes.

## WebSocket handlers

Built via `make_lifecycle_handlers(prefix="stripe", source=…)` — the
4 lifecycle handlers are auto-generated; only `stripe_trigger` is
plugin-specific:

| Type | Handler | Purpose |
|---|---|---|
| `stripe_connect` | `source.start()` | Spawn the daemon. Idempotent. |
| `stripe_disconnect` | `source.stop()` | Stop the daemon, cancel the secret-capture task. |
| `stripe_reconnect` | `source.restart()` | Stop + start. |
| `stripe_status` | `source.status()` + `has_credential()` | Returns `{connected, pid, webhook_secret_captured, has_stored_key}`. |
| `stripe_trigger` | `run_cli_command("stripe", ["trigger", event])` | Synthetic test event. |

## Webhook signature verification

`StripeVerifier` ([`server/services/events/verifiers/stripe.py`](../server/services/events/verifiers/stripe.py))
implements [Stripe's webhook signature scheme](https://stripe.com/docs/webhooks/signatures):

- Header format: `Stripe-Signature: t=<unix_ts>,v1=<hex_hmac>[,v1=<rotated>]`
- Signed payload: `f"{timestamp}.{raw_body}"`
- Algorithm: HMAC-SHA256 hex-encoded
- Multiple `v1=` entries are accepted (secret rotation)

Verifier raises `ValueError` on mismatch; `WebhookSource.handle`
catches it and returns HTTP 400. If the signing secret hasn't been
captured yet (race between first webhook and the `whsec_…` banner),
the framework logs a warning and accepts the event without
verification — this only happens during the first ~5 seconds of
daemon startup.

## Status broadcasting

`make_status_refresh(source, status_key="stripe", broadcast_type="stripe_status")`
runs once per WebSocket-client connect (via the
`register_service_refresh` registry):

1. Auto-reconnects the daemon if a `stripe_api_key` is stored but
   the daemon isn't running.
2. Mirrors the source's status into `broadcaster._status["stripe"]`.
3. Broadcasts a `stripe_status` message to every connected client.

The broadcast payload:

```json
{
  "type": "stripe_status",
  "data": {
    "connected": true,
    "pid": 12345,
    "webhook_secret_captured": true
  }
}
```

The frontend Credentials Modal renders this as the connection
indicator.

## Installation

The Stripe CLI must be installed and on `PATH`:

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (Scoop)
scoop install stripe

# Linux (apt)
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" \
  | sudo tee /etc/apt/sources.list.d/stripe.list
sudo apt update && sudo apt install stripe

# Direct binary
# https://github.com/stripe/stripe-cli/releases
```

`StripeListenSource.start()` resolves the binary via
`shutil.which("stripe")`. If missing, the WS `stripe_connect`
response is:

```json
{
  "success": false,
  "error": "'stripe' not on PATH. Install: https://stripe.com/docs/stripe-cli#install"
}
```

## Configuration

No JSON config file. Everything plugin-configurable lives on the
class attributes:

| Knob | Where | Default |
|---|---|---|
| Daemon process name | `StripeListenSource.process_name` | `"stripe-listen"` |
| Binary name | `StripeListenSource.binary_name` | `"stripe"` |
| Workspace subdir | `StripeListenSource.workflow_namespace` | `"_stripe"` (under `Settings().workspace_base_resolved`) |
| Webhook path | `StripeWebhookSource.path` | `"stripe"` (i.e. `/webhook/stripe`) |
| Forward-to port | derived from `Settings().port` | typically `3010` |
| Verifier | `StripeWebhookSource.verifier` | `StripeVerifier` |
| Action operation cost | `@Operation("run", cost=…)` | `{service: "stripe", action: "run", count: 1}` |

The CLI's webhook secret (`whsec_…`) is captured at runtime and
persisted automatically — no manual config step.

## Credentials Modal UI

The Stripe panel lives in the Payments category (introduced
specifically for this plugin in the `payments` palette group). It
provides:

- **API key** input (secret) — pasted from Stripe Dashboard.
- **Connect / Disconnect** buttons → fire `stripe_connect` /
  `stripe_disconnect` WebSocket messages.
- **Status indicator** — driven by the `stripe_status` broadcast
  (`connected`, `webhook_secret_captured`).
- **Reconnect** button — issues `stripe_reconnect` for stuck states.

No webhook-secret input is needed — the daemon captures it
automatically. The UI surfaces "secret captured ✓" once the value is
persisted.

## Operational notes

### API key in process argv

`stripe listen --api-key sk_test_…` puts the key in the daemon's
command line, which means it's visible to anyone with `ps` access on
the host **and** in `ProcessService`'s `command` field which is
logged at INFO. Acceptable on a single-user dev machine — Stripe's
docs explicitly endorse the `--api-key` flag for headless use. If a
future deployment hosts multiple tenants, swap to environment-variable
injection (a one-line change to `DaemonEventSource.start` to merge
caller-supplied env into the subprocess env).

### Webhook secret race window

The first ~5 seconds after `stripe_connect`, the secret-capture task
hasn't yet matched the `whsec_…` line in stderr. If a webhook arrives
during that window, the framework logs a warning and accepts the
event without verification. In practice this is benign because Stripe
won't deliver real events until the daemon is fully ready, but
synthetic events triggered via `stripe_trigger` immediately after
connect can hit this path.

### Single global daemon

One Stripe account per MachinaOs install. The daemon is
singleton-global (`workflow_id="_stripe_global"`). Multi-account
support is deferred to a future revision; the design holds — give
`StripeListenSource` a `__init__(account_id)` and key the singleton
by id.

### No auto-restart on crash

If `stripe listen` exits unexpectedly, the framework surfaces the
disconnected status and waits for the user to reconnect via the
Credentials Modal. The `_capture_secret` task hits EOF on the log
file and exits cleanly. There's no exponential-backoff respawn loop
— that's deliberate to keep failing daemons visible rather than
hidden behind silent retries.

## Verification

End-to-end smoke (requires Stripe CLI installed, test API key in
Credentials):

1. **Daemon start.** WS `{"type":"stripe_connect"}` → confirm:
   - `process_service.list_processes("_stripe_global")` shows
     `stripe-listen` running.
   - Within ~3 s the stderr.log contains `whsec_…`.
   - `auth_service.get_api_key("stripe_webhook_secret")` returns the
     secret.
   - WS reply: `{connected: true, webhook_secret_captured: true}`.
2. **Synthetic event.** Build a workflow with `StripeReceiveNode`
   (filter: `charge.*`) → console node. Deploy. WS
   `{"type":"stripe_trigger","event":"charge.succeeded"}`. Console
   fires with `event_type="charge.succeeded"`, `event_id` matches the
   CLI's emitted event.
3. **Filter rejection.** Set filter to `payment_intent.created`,
   retrigger `charge.succeeded` — node does NOT fire. Trigger
   `payment_intent.created` — it does.
4. **Action node.** Configure `StripeActionNode` with
   `command="customers create --email rosy@sparrow.com"`. Run. Output
   contains `id: cus_…`, `email: rosy@sparrow.com`.
5. **AI tool surface.** From a chat agent, prompt
   "create a Stripe test customer with email rosy@sparrow.com"; the
   LLM emits a `stripeAction.run` tool call.
6. **Signature failure.**
   `curl -X POST -H "Stripe-Signature: t=0,v1=garbage" http://localhost:3010/webhook/stripe -d '{}'`
   returns 400; no event dispatched.
7. **Reconnect.** WS `stripe_disconnect` → process gone. WS
   `stripe_reconnect` → idempotent reattach + new `whsec_…` capture.
8. **Auto-reconnect.** Restart MachinaOs. On first WS-client connect,
   `make_status_refresh` sees the stored key and auto-spawns the
   daemon.

Unit tests live in [`server/tests/nodes/test_stripe_plugin.py`](../server/tests/nodes/test_stripe_plugin.py)
(21 tests) and [`server/tests/services/test_events.py`](../server/tests/services/test_events.py)
(18 framework tests). Run via `pytest server/tests/services/test_events.py
server/tests/nodes/test_stripe_plugin.py -v`.

## Related Docs

- [Plugin System → Wave 12 framework](./plugin_system.md#wave-12--generalized-event-framework-servicesevents) — the framework Stripe is built on.
- [Plugin System → Self-contained plugin folders](./plugin_system.md#self-contained-plugin-folders) — Wave 11.H pattern Stripe also follows.
- [Node Creation Guide](./node_creation.md) — when to use which framework piece for a new plugin.
- [Event Waiter System](./event_waiter_system.md) — generic dispatch path that `WebhookSource.handle` calls into.
- [Status Broadcaster](./status_broadcaster.md) — `register_service_refresh` registry that backs `make_status_refresh`.
- [Credentials Encryption](./credentials_encryption.md) — how `stripe_api_key` and `stripe_webhook_secret` are stored.
