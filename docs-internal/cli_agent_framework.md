# AI CLI Agent Framework

Multi-instance, multi-provider runtime for AI CLI agents (Claude Code, Codex, Gemini). One workflow node spawns N parallel CLI sessions over a list of tasks, each isolated in its own git worktree, each able to call back into MachinaOs over MCP.

| Provider | Status | Login flow |
|---|---|---|
| Claude Code (`@anthropic-ai/claude-code`) | shipping | Local-install + spawn (`services/claude_oauth.py:initiate_claude_oauth`) |
| OpenAI Codex (`@openai/codex`) | shipping (no login flow yet) | User runs `codex login` manually; UI returns a graceful "not yet wired" error |
| Google Gemini (`@google/gemini-cli`) | v2 stub | factory raises `NotImplementedError` |

## Architecture

```
ClaudeCodeAgentNode (claude_code_agent)        CodexAgentNode (codex_agent)
        │ Params.tasks: list[ClaudeTaskSpec]            list[CodexTaskSpec]
        ▼
AICliService.run_batch(provider, tasks, *, node_id, workflow_id, workspace_dir)
        │ provider = create_cli_provider(name)  ("claude" | "codex" | "gemini"→NotImpl)
        │ allocate per-batch bearer token; register BatchContext in MCP token registry
        │ asyncio.gather under Semaphore(5)
        │
        ├──► AICliSession_0 (BaseProcessSupervisor + ClaudeProvider + ClaudeTaskSpec)
        │       _pre_spawn():   git worktree add  +  write ~/.claude/ide/<pid>.lock
        │       _do_start():    anyio.open_process + NDJSON stdout/stderr consumers
        │                       env: CLAUDE_IDE_LOCK + MACHINA_PARENT_RUN_ID
        │       wait_for_completion(timeout)
        │       cleanup():      stop()=terminate_then_kill(5s) + rm lockfile + worktree remove
        │
        └──► AICliSession_N (CodexProvider + CodexTaskSpec)
                 (no lockfile yet — Codex CLI doesn't honor it; written when upstream supports it)
        │
        │  ◄────  CLI calls back via MCP/HTTP at /mcp/ide
        │           Authorization: Bearer <batch-token>  (per-batch isolation)
        │           tools: getWorkspaceFiles, listSkills, getSkill, getCredential, broadcastLog
        ▼
BatchResult { tasks: [SessionResult, ...], n_succeeded, n_failed, total_cost_usd?, wall_clock_ms }
        │ token deregistered in finally
        ▼
existing Temporal heartbeat fires per WS broadcast (services/temporal/activities.py:228)
existing tool-result envelope truncates response at 4000 chars (services/handlers/tools.py:678)
```

Reuses (do not duplicate):

- `services/_supervisor/{base,process,util}.py` — `BaseProcessSupervisor` (locked start/stop, `kill_tree`, `terminate_then_kill(5s)`, drain tasks, Windows `CTRL_BREAK_EVENT`)
- `services/llm/{protocol,factory,config}.py` — Protocol + lazy-import factory + JSON config blueprint
- `services/handlers/tools.py:678` — 4000-char truncation
- `services/status_broadcaster.py` — `update_node_status`, `broadcast_terminal_log`
- `services/skill_loader.py` — `scan_skills` / `load_skill` consumed by MCP `listSkills` / `getSkill`
- `services/auth.py` — `AuthService.get_api_key` consumed by MCP `getCredential`
- `services/credential_registry.py` — deep-merge `extends` for `_cli_base` entry
- `services/claude_oauth.py` — Claude `auth login` / `auth status` / `auth logout` wrappers, project-local npm install at `<repo>/data/claude-machina/npm/`, inherited stdio so the CLI opens the browser itself
- `nodes/stripe/_handlers.py` — pattern reference for marker-token + catalogue broadcast

## Provider abstraction (mirrors `services/llm/`)

```python
# server/services/cli_agent/protocol.py
@runtime_checkable
class AICliProvider(Protocol):
    name: str
    package_name: str
    binary_name: str
    ide_lock_env_var: Optional[str]   # CLAUDE_IDE_LOCK | GEMINI_IDE_LOCK | None
    ide_lockfile_dir: Optional[Path]  # ~/.claude/ide | <tmpdir>/gemini/ide

    def binary_path(self) -> Path: ...
    def headless_argv(self, task, *, defaults) -> list[str]: ...
    def login_argv(self) -> list[str]: ...                      # CLI's own login command
    def auth_status_argv(self) -> Optional[list[str]]: ...      # cheap probe
    def detect_auth_error(self, stderr, exit_code) -> bool: ...
    def parse_event(self, line: str) -> Optional[dict]: ...
    def is_final_event(self, event: dict) -> bool: ...
    def event_to_session_result(self, events, stderr, exit_code) -> dict: ...
        # Returns: {...shared, "provider_data": {<vendor-specific>}}
        # provider_data carries Anthropic reasoning_details, Codex call_id,
        # Gemini extra_content — pattern from Hermes agent/transports/types.py.
    def canonical_usage(self, events) -> CanonicalUsage: ...
        # Normalises vendor token-counting; feeds services/pricing.py.
    def supports(self, feature: str) -> bool: ...
        # max_budget | max_turns | session_id | resume | mcp_runtime
        # | json_cost | ide_lockfile | sandbox
```

Factory:

```python
# server/services/cli_agent/factory.py
SUPPORTED_PROVIDERS = frozenset({"claude", "codex"})  # gemini is v2 stub

def create_cli_provider(name: str) -> AICliProvider:
    if name == "claude": return AnthropicClaudeProvider()
    if name == "codex":  return OpenAICodexProvider()
    if name == "gemini": raise NotImplementedError("gemini deferred to v2")
    raise ValueError(f"Unknown CLI provider: {name!r}")
```

## Task specs (discriminated union)

```python
# server/services/cli_agent/types.py
class BaseAICliTaskSpec(BaseModel):
    task_id: Optional[str] = None
    prompt: str
    branch: Optional[str] = None
    model: Optional[str] = None
    timeout_seconds: int = Field(600, ge=10, le=3600)
    system_prompt: Optional[str] = None

class ClaudeTaskSpec(BaseAICliTaskSpec):
    provider: Literal["claude"] = "claude"
    session_id: Optional[str] = None
    resume_session_id: Optional[str] = None
    max_turns: Optional[int] = None
    max_budget_usd: Optional[float] = None
    allowed_tools: Optional[str] = None
    permission_mode: Literal["default", "acceptEdits", "plan", "auto"] = "acceptEdits"

class CodexTaskSpec(BaseAICliTaskSpec):
    provider: Literal["codex"] = "codex"
    sandbox: Literal["read-only", "workspace-write", "danger-full-access"] = "workspace-write"
    ask_for_approval: Literal["untrusted", "on-request", "never"] = "never"

class GeminiTaskSpec(BaseAICliTaskSpec):
    provider: Literal["gemini"] = "gemini"
    session_id: Optional[str] = None
    resume: Optional[str] = None
    yolo: bool = False
    sandbox: bool = False

AICliTaskSpec = Annotated[
    Union[ClaudeTaskSpec, CodexTaskSpec, GeminiTaskSpec],
    Field(discriminator="provider"),
]
```

Each plugin's `Params.tasks` is hard-typed to one variant — the LLM tool-schema fast-path at `services/ai.py:2898` produces a clean per-provider schema (no `$defs`/`$ref`).

## Auth model — Stripe-style CLI-managed OAuth

CLI auth is delegated to the CLI's own login flow + a synthetic marker token in MachinaOs's catalogue. Mirrors `nodes/stripe/_handlers.py` (commit `a32f671`).

**Per-provider WS handler names** (Twitter / Google / Stripe convention — frontend dispatches `{}` payload, handler name encodes provider):

| Catalogue id | Login handler | Logout handler |
|---|---|---|
| `claude_code` | `claude_code_login` | `claude_code_logout` |
| `codex_cli`   | `codex_cli_login` (returns "not yet wired") | `codex_cli_logout` |

**Claude flow** (`server/services/cli_agent/_handlers.py:handle_claude_code_login`) uses the documented CLI subcommands from [code.claude.com/docs/en/cli-reference](https://code.claude.com/docs/en/cli-reference):

| Subcommand | Purpose |
|---|---|
| `claude auth login` | Opens the browser, writes credentials |
| `claude auth status` | Exits 0 when logged in, 1 otherwise |
| `claude auth logout` | Clears credentials |

Steps:

1. Run `claude auth status`. If it exits 0, write the marker + broadcast and return immediately (idempotent re-click).
2. Otherwise call `services.claude_oauth.initiate_claude_oauth()`:
   - Project-local install of `@anthropic-ai/claude-code` into `<repo>/data/claude-machina/npm/` via `npm install --prefix` (mirrors WhatsApp's `<repo>/node_modules/edgymeow/` layout; skipped if already installed).
   - `asyncio.create_subprocess_exec(claude, "auth", "login", env={..., CLAUDE_CONFIG_DIR=<repo>/data/claude-machina})` with **inherited stdio** — same way the VSCode Claude Code extension delegates to the binary. Anthropic doesn't expose `--print-url` or a programmatic OAuth helper (issue [anthropics/claude-code#7100](https://github.com/anthropics/claude-code/issues/7100), closed "not planned"), so we let the CLI open the user's browser via its own OS-level call. Returns `{success: True, pid}` immediately.
3. Schedule a background task that polls `claude auth status` every 2s up to 600s. On exit-0, write the synthetic `"cli-managed"` marker via `auth_service.store_oauth_tokens("claude_code", ...)` and broadcast `credential_catalogue_updated`. The catalogue's `stored` flag flips and the existing `OAuthConnect.tsx` primitive renders the modal as Connected.

**Logout**: runs `claude auth logout`, drops the marker via `auth_service.remove_oauth_tokens()`, and broadcasts.

**Codex login**: not yet wired. The handler returns a graceful error pointing the user at `npm install -g @openai/codex` + `codex login` manual flow. Follow-up: write `services/codex_oauth.py` mirroring `claude_oauth.py` with `HOME=~/.codex-machina` env redirect (Codex has no `CONFIG_DIR` equivalent).

**Frontend**: no changes. The existing `client/src/components/credentials/primitives/OAuthConnect.tsx:42-44` already documents and supports the Stripe-style fieldless-CLI case (`config.fields = []`, `kind: "oauth"`, `stored` flag drives Connected state).

## VSCode-style IDE MCP server

Spawned CLI sessions auto-discover MachinaOs over MCP via the lockfile pattern VSCode's Claude Code extension uses. No custom IPC.

Lockfile path: `~/.claude/ide/<pid>.lock` (Claude) or `<tmpdir>/gemini/ide/gemini-ide-server-<pid>-<port>.json` (Gemini, v2). Format mirrors VSCode exactly:

```json
{
  "port": 3010,
  "url": "http://127.0.0.1:3010/mcp/ide",
  "authToken": "<32-byte hex>",
  "workspaceFolders": ["<absolute path to per-task git worktree>"],
  "ideName": "machinaos",
  "transport": "http",
  "pid": 12345
}
```

Bearer-token middleware (`mcp_server.py:_BearerAuthMiddleware`) validates each request against an in-memory per-batch `BatchContext` registry. Tokens registered at `AICliService.run_batch()` entry; unregistered in `finally` so 401s flip immediately when a batch settles.

Tools exposed (mirror MachinaOs capabilities; deferred ones marked):

| Tool | Maps to | Returns |
|---|---|---|
| `mcp__machina__getWorkspaceFiles` | `Path.rglob` over `workspace_dir` | `{files: [{path, size, mtime, content?}]}` |
| `mcp__machina__listSkills` | `SkillLoader.scan_skills()` filtered to `BatchContext.connected_skill_names` | `{skills: [{name, description, allowed_tools, category}]}` (~100 tokens each) |
| `mcp__machina__getSkill` | `SkillLoader.load_skill(name)` | `{name, instructions, allowed_tools, scripts, references}` |
| `mcp__machina__getCredential` | `auth_service.get_api_key(name)`, gated by `BatchContext.allowed_credentials` | `{name, value}` or 403 |
| `mcp__machina__broadcastLog` | `broadcaster.broadcast_terminal_log()` | `{success}` |

Lifespan: `main.py` enters `mcp_app.router.lifespan_context()` so `StreamableHTTPSessionManager`'s task group is alive (Starlette doesn't auto-propagate `app.mount()` lifespans). Stale-PID lockfile sweep on startup (mirrors VSCode's behaviour).

## Files (current state)

| File | Purpose |
|---|---|
| `server/services/cli_agent/__init__.py` | Public re-exports + self-registers WS handlers via `services.ws_handler_registry` (telegram-style plugin-folder pattern). |
| `server/services/cli_agent/protocol.py` | `AICliProvider` Protocol + `CanonicalUsage` / `SessionResult` / `BatchResult` dataclasses. |
| `server/services/cli_agent/types.py` | Pydantic discriminated-union task specs + `BatchResultModel` for serialisation. |
| `server/services/cli_agent/config.py` | Loads `server/config/ai_cli_providers.json` (binary, package, defaults, supports flags per provider). |
| `server/services/cli_agent/factory.py` | `create_cli_provider(name)` lazy-import factory. |
| `server/services/cli_agent/lockfile.py` | VSCode-style IDE lockfile read/write/sweep. |
| `server/services/cli_agent/mcp_server.py` | FastMCP sub-app at `/mcp/ide` with bearer-token middleware + 5 tools. |
| `server/services/cli_agent/session.py` | `AICliSession(BaseProcessSupervisor)` per task — heart of framework. |
| `server/services/cli_agent/service.py` | `AICliService.run_batch()` — `asyncio.gather` under `Semaphore(5)` (no separate pool class), cancel hooks. |
| `server/services/cli_agent/_handlers.py` | Per-provider login/logout WS handlers (`claude_code_*`, `codex_cli_*`). |
| `server/services/cli_agent/providers/anthropic_claude.py` | Reference Claude provider — full feature surface. |
| `server/services/cli_agent/providers/openai_codex.py` | Codex provider — sandbox-first. |
| `server/services/cli_agent/providers/google_gemini.py` | v2 stub. |
| `server/config/ai_cli_providers.json` | Per-provider config (binary names, npm packages, login/auth_status argvs, lockfile dirs, supports flags). |
| `server/nodes/agent/claude_code_agent.py` | Refactored — `Params.tasks: list[ClaudeTaskSpec]` + legacy single-prompt fallback. |
| `server/nodes/agent/codex_agent.py` | New plugin — `Params.tasks: list[CodexTaskSpec]` + sandbox-focused defaults. |
| `server/nodes/visuals.json` | `claude_code_agent` + `codex_agent` icon/color entries. |
| `server/config/credential_providers.json` | `_cli_base` abstract + `claude_code` + `codex_cli` entries. |
| `server/services/claude_code_service.py` | Slimmed to a back-compat shim that builds one `ClaudeTaskSpec` and calls `AICliService.run_batch("claude", ...)`. Kept for legacy callers; eventually deletable. |
| `server/services/claude_oauth.py` | Unchanged. The new framework's Claude login handler reuses this directly. |
| `server/services/workflow.py` | `cancel_deployment` also calls `get_ai_cli_service().cancel_workflow(workflow_id)`. |
| `server/main.py` | Mounts `/mcp/ide` sub-app, composes its lifespan, runs stale-lockfile sweep on startup. Side-effect imports `services.cli_agent` so its WS handlers self-register. |
| `server/routers/websocket.py` | No CLI handlers inline — discovered via `services.ws_handler_registry.get_ws_handlers()`. |

## Output contract

```json
{
  "tasks": [{
    "task_id": "t_<8hex>",
    "session_id": "<UUID|null>",
    "provider": "claude|codex|gemini",
    "prompt": "...",
    "branch": "machina/t_<8hex>",
    "worktree_path": "<abs path, removed after batch>",
    "response": "<truncated to 4000 chars>",
    "cost_usd": 0.42,
    "duration_ms": 18234,
    "num_turns": 7,
    "tool_calls": 12,
    "canonical_usage": {
      "input_tokens": 5000, "output_tokens": 1000,
      "cache_read": 500, "cache_write": 0,
      "reasoning_tokens": 0, "request_count": 7
    },
    "provider_data": {
      "reasoning_details": "...",   // Claude only
      "call_id": "...",             // Codex only
      "extra_content": [...]        // Gemini only (v2)
    },
    "success": true, "error": null
  }],
  "summary": {
    "n_tasks": 3, "n_succeeded": 2, "n_failed": 1,
    "total_cost_usd": 1.23,
    "wall_clock_ms": 19002
  },
  "provider": "claude|codex|gemini",
  "timestamp": "2026-05-04T12:00:00Z"
}
```

`cost_usd` is the provider's reported value when available (Claude). For Codex (no native USD), `service.py:_derive_cost` falls back to `services.pricing.PricingService.calculate_cost()` from `canonical_usage` — single source of truth for LLM cost across MachinaOs. `summary.total_cost_usd` is `null` if any task didn't surface cost.

## Status broadcast events

| Phase | When | Payload |
|---|---|---|
| `batch_started` | `run_batch` entry | `{provider, n_tasks, max_parallel, isolation:"worktree"}` |
| `ai_cli_subtask` | per-task partial (NDJSON event) | `{task_id, provider, status:"running", message, cost_usd?, num_turns?}` |
| `ai_cli_subtask` | per-task final | `{task_id, provider, status:"succeeded"|"failed", cost_usd?, duration_ms, num_turns?, error?}` |
| `batch_complete` | aggregator finish | `{provider, n_succeeded, n_failed, total_cost_usd?, wall_clock_ms}` |

Plus `broadcast_terminal_log(source=f"{provider}:{task_id}", level)` on every NDJSON line — surfaced in the Terminal tab.

## Plugin contract — adding a new CLI provider

To add a fourth provider (e.g. Mistral CLI) post-v1:

1. New file `server/services/cli_agent/providers/<vendor>.py` implementing `AICliProvider`.
2. New entry in `server/config/ai_cli_providers.json`.
3. New `<vendor>TaskSpec` in `types.py` + register in the discriminated union.
4. New branch in `factory.create_cli_provider`.
5. New entry in `server/config/credential_providers.json` (`extends: "_cli_base"`).
6. New per-provider WS handlers in `_handlers.py` (login + logout) + entry in `WS_HANDLERS`.
7. New plugin file `server/nodes/agent/<vendor>_agent.py` (mirror `codex_agent.py`).
8. New entry in `server/nodes/visuals.json`.

No edits to `routers/websocket.py`, `main.py`, or any existing handler/service. The plugin auto-registers via `BaseNode.__init_subclass__` (Wave 11) + the `services.ws_handler_registry` self-registration in `cli_agent/__init__.py`.

## Verification

Unit tests (in `server/tests/services/cli_agent/`):

- `test_providers.py` — Claude + Codex argv shapes, parse_event fidelity (vendored NDJSON), event_to_session_result reconstruction, auth-error detection, `supports()` flags. Factory raises `NotImplementedError` for `gemini`.
- `test_mcp_server.py` — bearer-token registry register/lookup/unregister, 401 on missing/malformed/unknown/expired tokens, lockfile shape matches VSCode convention, stale-PID sweep.
- `test_service.py` — `not_git_repo` abort path, resolver contract (explicit `repo_root` doesn't fall back to cwd), cancel-when-idle, singleton.

Plugin contract: `tests/test_plugin_contract.py` + `tests/test_node_spec.py` — clean per-provider Params schemas, no `$defs`/`$ref` in the fast-path.

Live verification (needs a real Claude install + auth):

1. Empty `<repo>/data/claude-machina/`. Open Credentials Modal → click "Login with Claude Code CLI". Confirm the npm install runs (visible in backend logs), `<repo>/data/claude-machina/npm/node_modules/.bin/claude[.cmd]` appears, browser opens for Anthropic OAuth. Modal flips Connected within ~2s of CLI exit (background `claude auth status` poll detects success).
2. Refresh the page. Modal stays Connected (`auth_service.get_oauth_tokens("claude_code")` still returns the marker; idempotent re-click also stays Connected).
3. Click Disconnect. Modal flips Disconnected (`claude auth logout` clears CLI creds + marker dropped).
4. Add a `claude_code_agent` node, set `tasks=[{prompt:"echo A"},{prompt:"echo B"},{prompt:"echo C"}]`, run. Three distinct `claude:<task_id>` Terminal streams interleaved. Three distinct session_ids. Three worktrees created and removed. `summary.wall_clock_ms < sum(duration_ms)` (proves parallelism).
5. With a Claude task running, `cat ~/.claude/ide/<pid>.lock` and confirm format. Stream-json shows an `mcp__machina__*` tool invocation.
6. `curl -H "Authorization: Bearer <wrong>" http://127.0.0.1:3010/mcp/ide/...` → 401.

## Risks / open considerations

- **Codex login not yet wired.** v1 returns a graceful error directing the user to `npm install -g @openai/codex` + `codex login`. Follow-up: `services/codex_oauth.py` mirroring `claude_oauth.py` with `HOME=~/.codex-machina` env redirect (Codex has no `CONFIG_DIR` env; `HOME` redirect is risky on Windows, so Windows may need a different strategy or accept user-global Codex auth).
- **Gemini deferred.** `factory.create_cli_provider("gemini")` raises `NotImplementedError`. v2 work: implement `providers/google_gemini.py`, drop the factory branch, add `nodes/agent/gemini_cli_agent.py`. ~430 LoC. No abstraction changes needed.
- **`--include-partial-messages`** assumes a recent Claude CLI; older versions fall back gracefully via the parser's `parse_event` returning `None` for unknown shapes.
- **Browser-prompt phrasing** can change between Claude CLI versions; `b"yes\nyes\n"` might land on the wrong question. Defensible because that's exactly what `claude_oauth.py` has been doing in production.
- **Marker token written without verifying CLI is actually functional** — we trust `claude auth status`'s exit code. If Anthropic invalidates the token server-side and the CLI hasn't re-checked, the modal still shows Connected until the next session attempt's `detect_auth_error` catches it.
- **MCP SDK is pre-1.0-stable.** Pinned at `mcp>=1.0.0`. The surface is isolated in `mcp_server.py` so an SDK breaking change touches one file.
- **Concurrent install safety.** `claude_oauth.py:_get_claude_cmd` doesn't currently use a lock — two simultaneous login clicks within 2s could race the npm install. Low-risk in practice (modal debounces clicks); a follow-up could add an `asyncio.Lock`.
- **Worktree leak on hard crash.** Out-of-scope cleanup pass; document.
