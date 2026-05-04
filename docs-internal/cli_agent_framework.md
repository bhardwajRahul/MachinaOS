# AI CLI Agent Framework — Claude Code + Codex (v1), Gemini (v2)

## Context

`claude_code_agent` ([server/services/claude_code_service.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/claude_code_service.py)) today is single-instance, single-shot, Claude-only: wraps `asyncio.create_subprocess_exec` with `proc.communicate()`, hardcoded 300s `wait_for`, bypasses the existing `_supervisor` framework, and returns plain text.

**Scope priority — heavy bias toward Claude + Codex.** v1 ships these two only; Gemini is designed-for but deferred to v2. Rationale:

- **Claude Code** = the marquee provider. Full feature surface (sessions, resume, budget, turns, `allowedTools`, `permission-mode`), best stream-json (cost+turns+session_id in `result` event), mature MCP/IDE lockfile integration. Reference implementation for the VSCode pattern.
- **Codex** = the safety-first companion. Sandbox enforcement (`read-only|workspace-write|danger-full-access`) and `--ask-for-approval` make it the right pick for risk-bounded tasks even though it lacks sessions/resume/cost.
- **Gemini** = parity is straightforward but not load-bearing — the abstraction is built to absorb it without refactor in v2.

We need:

1. **Multi-instance** — one workflow node summons N parallel CLI sessions over a list of tasks, each isolated, returning aggregated structured output, cancellable.
2. **Multi-provider abstraction now** — even though only two providers ship in v1, the Protocol/factory/config layer is built upfront so adding Gemini in v2 is a drop-in.
3. **Tool/context injection without custom IPC** — follow VSCode/Cursor exactly: host an MCP server, write a discovery lock file, let CLIs auto-discover MachinaOs tools via the standard MCP protocol. v1 wires this for Claude (where it works today) and writes the lock file for Codex (cheap; Codex CLI doesn't honor it yet but will).
4. **Native CLI auth — no token wrapping** — the CLIs already have working `claude login` / `codex login` flows that store credentials in their own canonical locations (`~/.claude/`, `~/.codex/`, `~/.gemini/`). MachinaOs **does not** copy, encrypt, or relocate those credentials. We only **trigger** the native login flow and **detect** logged-in state. No isolated `~/.claude-machina/` auth dir for the new framework. No `codex_oauth.py` / `gemini_oauth.py` token-management modules.

The fix reuses three existing assets:

- **Supervisor framework** ([_supervisor/base.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/_supervisor/base.py), [process.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/_supervisor/process.py), [util.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/_supervisor/util.py)) — locked idempotent start/stop, `terminate_then_kill(grace=5s)`, recursive `kill_tree`, drain-task cancel, Windows `CTRL_BREAK_EVENT`. Canonical consumer: [whatsapp/_runtime.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/nodes/whatsapp/_runtime.py).
- **Native LLM provider layer** ([llm/protocol.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/protocol.py), [factory.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/factory.py), [providers/](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/providers)) — `@runtime_checkable` Protocol + lazy-import factory + JSON config. Mirror exactly for CLI providers.
- **Credentials registry** ([credential_registry.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/credential_registry.py), [credential_providers.json](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/config/credential_providers.json)) — add `_cli_base` abstract entry + three concrete entries via deep-merge.

## Confirmed design decisions

| Decision | Choice |
|---|---|
| Source branch | `credentials-scaling-v2` (current worktree) |
| Implementation worktree | **NEW** worktree at `D:\startup\projects\machinaos-worktrees\cli-agent-framework` on branch `feat/cli-agent-framework` (off `credentials-scaling-v2`) |
| Scope (v1) | **Claude Code + Codex** (heavy bias). Gemini provider/plugin/oauth/tests deferred to v2. |
| Per-task isolation | git worktree per task (fail batch early if `working_directory` is not a git repo) |
| Concurrency cap | 5 parallel sessions per pool (`asyncio.Semaphore`) |
| Failure mode | Continue-on-error; per-task success/error returned, batch always settles |
| Resumption | Claude: `--session-id`/`--resume`. Codex: N/A. (Gemini v2: `--session-id`/`--resume`) |
| Provider feature gaps | Discriminated-union Pydantic TaskSpec — `ClaudeTaskSpec` / `CodexTaskSpec` (v2 adds `GeminiTaskSpec` to the union) |
| Tool/context injection | **VSCode pattern**: local MCP server + lock file, no custom IPC. v1 active for Claude; v1 writes lock for Codex (cheap, future-proofs); Gemini v2. |
| Node shape | Two plugins in v1: `claude_code_agent` (refactored), `codex_agent` (new). v2 adds `gemini_cli_agent`. |

## Step 0 — bootstrap (first actions after ExitPlanMode)

**0a. Copy plan into the repo as a versioned design doc** so it's reviewable, diffable, and lives alongside the existing `docs-internal/` design docs:

```bash
cp C:/Users/Tgroh/.claude/plans/analyze-the-claude-code-purrfect-sunbeam.md \
   D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/docs-internal/cli_agent_framework.md
```

Drop the path-specific Windows-style absolute paths from the in-repo copy if they look out of place; the repo copy is the source of truth from this point forward.

**0b. Create the implementation worktree** off `credentials-scaling-v2`:

```bash
cd D:/startup/projects/machinaos-worktrees/credentials-scaling-v2
git worktree add -b feat/cli-agent-framework \
    D:/startup/projects/machinaos-worktrees/cli-agent-framework \
    credentials-scaling-v2
cd D:/startup/projects/machinaos-worktrees/cli-agent-framework
```

The new design doc (`docs-internal/cli_agent_framework.md`) is automatically present in the new worktree because `git worktree add` shares the working tree of the parent branch. All subsequent edits below land in the new worktree. The `credentials-scaling-v2` worktree stays clean except for the new design doc.

**0c. (Optional, recommended)** Commit the design doc on `credentials-scaling-v2` before branching, so it's traceable:

```bash
cd D:/startup/projects/machinaos-worktrees/credentials-scaling-v2
git add docs-internal/cli_agent_framework.md
git commit -m "docs: cli agent framework design (claude+codex v1, gemini v2)"
```

## CLI feature surface (raw GitHub source confirmed)

| Feature | Claude | Codex | Gemini |
|---|---|---|---|
| Headless flag | `--print -p` | `codex exec` | `--prompt -p` |
| JSON output | `--output-format json/stream-json` | `--json` (JSONL) | `--output-format json/stream-json` |
| Session ID | `--session-id <UUID>` | n/a | **`--session-id <UUID>`** (`config.ts`) |
| Resume | `--resume <UUID>` | n/a | `--resume latest|<idx>|<UUID>` |
| Model | `--model` | `--model` | `--model` |
| Max turns | `--max-turns <n>` | n/a | n/a |
| Budget | `--max-budget-usd <usd>` | n/a | n/a |
| Allowed tools | `--allowedTools` | n/a | n/a |
| MCP config | `--mcp-config <file>` + IDE lockfile auto-discovery | pre-config only (lockfile not yet honored) | `--mcp-config` + IDE lockfile auto-discovery |
| Sandbox | `--worktree` | `--sandbox read-only|workspace-write|danger-full-access` | `--sandbox` (Docker) |
| Auth env | `CLAUDE_CONFIG_DIR` | `CODEX_API_KEY_ENV_VAR` / `OPENAI_API_KEY_ENV_VAR` / `CODEX_AGENT_IDENTITY_ENV_VAR` | `GEMINI_CLI_HOME` |
| IDE lock env | `CLAUDE_IDE_LOCK` | (n/a v1) | `GEMINI_IDE_LOCK` |
| Cost in JSON | `total_cost_usd` | absent | absent (`stats.duration_ms` only) |
| Exit codes | 0=ok, 1=error | 0=ok, non-0=error | 0=ok, 1=`FatalAuthenticationError`, EPIPE→0 |

## Confirmed JSON event schemas (vendored from source)

**Claude `--output-format stream-json`:**
```
{"type":"system","subtype":"init","session_id":"<UUID>"}
{"type":"assistant","message":{...},"session_id":"<UUID>"}
{"type":"tool_use","tool_name":"...","tool_input":{...}}
{"type":"result","subtype":"success","result":"...","total_cost_usd":0.42,
 "duration_ms":18234,"num_turns":7,"session_id":"<UUID>"}
```
Final: `type=="result"`. Carries `total_cost_usd, duration_ms, num_turns, session_id`.

**Gemini** (`packages/cli/src/nonInteractiveCli.ts`):
```typescript
enum JsonStreamEventType {
  INIT='init', MESSAGE='message', TOOL_USE='tool_use',
  TOOL_RESULT='tool_result', ERROR='error', RESULT='result'
}
// RESULT: { type:'result', timestamp:<ISO8601>, status:'success',
//           session_id:<UUID>, stats:{ duration_ms } }
```
Final: `type=="result"`. Carries `session_id` + `stats.duration_ms`. No USD.

**Codex** (`codex-rs/cli/src/main.rs`, Rust + `clap` v4): JS wrapper at `codex-cli/bin/codex.js` is pass-through (`spawn(binaryPath, process.argv.slice(2), { stdio: "inherit" })`). No public stream-json schema; best-effort `type=="complete"` or stream-end fallback. `cost_usd=null` always.

## Architecture

```
ClaudeCodeAgentNode (v1)        CodexAgentNode (v1)        [GeminiCliAgentNode v2]
        │ Params.tasks: list[ClaudeTaskSpec]      list[CodexTaskSpec]
        ▼
AICliService.run_batch(provider, params, *, node_id, workflow_id, workspace_dir)
        │ provider = create_cli_provider(provider_name)
        │   "claude" → AnthropicClaudeProvider     "codex" → OpenAICodexProvider
        │   "gemini" → NotImplementedError("deferred to v2")
        │ allocate per-batch bearer token; register in MCP token registry
        ▼
AICliBatchPool(provider, sessions[N], semaphore=5, batch_token)
        │ asyncio.gather(return_exceptions=False)
        │
        ├──► AICliSession_0(BaseProcessSupervisor, ClaudeProvider, ClaudeTaskSpec)
        │       _pre_spawn(): git worktree add  +  write ~/.claude/ide/<pid>.lock
        │       _do_start():  anyio.open_process + NDJSON consumers
        │                     env: inherits parent (claude CLI reads its native ~/.claude/)
        │                          + CLAUDE_IDE_LOCK=<path>
        │                          + MACHINA_PARENT_RUN_ID=<wf>:<node>:<token8>
        │       (Claude CLI auto-discovers MCP, gains mcp__machina__* tools)
        │       wait_for_completion(timeout)
        │       cleanup(): stop()=terminate_then_kill(5s) + remove lockfile + worktree remove
        └──► AICliSession_1(CodexProvider, CodexTaskSpec)
                _pre_spawn(): git worktree add (no lockfile env — Codex CLI doesn't honor it yet)
                _do_start():  argv has --sandbox + --ask-for-approval
                              env: inherits parent (codex CLI reads its native ~/.codex/auth.json)
                              (sandbox enforced by CLI itself)
                wait_for_completion(timeout)
                cleanup(): stop() + worktree remove
        │
        │  ◄────── CLI calls back via MCP/HTTP
        │            POST http://127.0.0.1:<port>/mcp/ide
        │            Authorization: Bearer <batch-token>
        │            tools: getWorkspaceFiles | getSkills | getCredential | broadcastLog
        ▼
BatchResult{ tasks: [...], summary: {n_tasks, n_succeeded, n_failed,
                                     total_cost_usd?, wall_clock_ms} }
        │ batch_token deregistered in finally
        ▼
existing Temporal heartbeat hook wakes on each broadcast (activities.py:228)
existing tool-result envelope truncates response at 4000 chars (handlers/tools.py:678)
```

## Provider abstraction (mirrors `services/llm/`)

```python
# server/services/cli_agent/protocol.py
@runtime_checkable
class AICliProvider(Protocol):
    name: str                          # "claude" | "codex" | "gemini"
    package_name: str                  # npm package
    binary_name: str                   # "claude" | "codex" | "gemini"
    ide_lock_env_var: Optional[str]    # CLAUDE_IDE_LOCK | GEMINI_IDE_LOCK | None
    ide_lockfile_dir: Optional[Path]   # ~/.claude/ide | <tmpdir>/gemini/ide
    # NOTE: no auth_dir_env_var / isolated_auth_dir. The CLI uses its own
    # native auth storage (~/.claude/, ~/.codex/, ~/.gemini/). We do not wrap.

    def binary_path(self) -> Path: ...
    def headless_argv(self, task, *, defaults) -> list[str]: ...
    def login_argv(self) -> list[str]: ...
        # Returns the CLI's own native login command, e.g. ["claude", "login"]
        # or ["codex", "login"]. Spawned interactively from the Credentials
        # Modal. CLI stores its own credentials; we don't intercept.
    def auth_status_argv(self) -> Optional[list[str]]: ...
        # Optional: a no-op command to verify auth (e.g. ["claude", "--version"]
        # combined with a no-op `--print -p ""` invocation). If None, we infer
        # from the next session's stderr matcher.
    def detect_auth_error(self, stderr: str, exit_code: int) -> bool: ...
        # Matcher for "not logged in" stderr patterns:
        #   Claude: "Please run 'claude login'"
        #   Codex:  HTTP 401 / "OPENAI_API_KEY not set"
        #   Gemini: exit_code == 1 (FatalAuthenticationError)
    def parse_event(self, line: str) -> Optional[dict]: ...
    def is_final_event(self, event: dict) -> bool: ...
    def event_to_session_result(self, events, stderr, exit_code) -> dict: ...
        # Returns: { ...shared fields..., "provider_data": {<vendor-specific>} }
        # provider_data carries vendor-only metadata (Anthropic reasoning_details,
        # Codex call_id, Gemini extra_content) without bloating the shared schema.
        # Pattern from Hermes agent/transports/types.py.
    def canonical_usage(self, events) -> dict: ...
        # Normalize vendor token-counting into {input, output, cache_read,
        # cache_write, reasoning, request_count}. Pattern from Hermes
        # agent/usage_pricing.py CanonicalUsage. Feeds existing services/pricing.py.
    def supports(self, feature: str) -> bool: ...
        # features: max_budget, max_turns, session_id, resume, mcp_runtime, json_cost, ide_lockfile
```

```python
# server/services/cli_agent/factory.py
def create_cli_provider(name: str) -> AICliProvider:
    if name == "claude":
        from .providers.anthropic_claude import AnthropicClaudeProvider
        return AnthropicClaudeProvider()
    if name == "codex":
        from .providers.openai_codex import OpenAICodexProvider
        return OpenAICodexProvider()
    if name == "gemini":
        from .providers.google_gemini import GoogleGeminiProvider
        return GoogleGeminiProvider()
    raise ValueError(f"Unknown CLI provider: {name}")
```

```jsonc
// server/config/ai_cli_providers.json
{
  "claude":  { "package_name":"@anthropic-ai/claude-code", "binary_name":"claude",
               "login_argv": ["claude", "login"],
               "auth_status_argv": ["claude", "--print", "-p", "ok"],
               "ide_lock_env_var":"CLAUDE_IDE_LOCK",
               "ide_lockfile_dir":"~/.claude/ide",
               "default_model":"claude-sonnet-4-6", "default_max_turns":10,
               "default_max_budget_usd":5.0, "default_allowed_tools":"Read,Edit,Bash,Glob,Grep,Write",
               "supports":["max_budget","max_turns","session_id","resume","mcp_runtime","json_cost","ide_lockfile"] },
  "codex":   { "package_name":"@openai/codex", "binary_name":"codex",
               "login_argv": ["codex", "login"],
               "auth_status_argv": ["codex", "--version"],
               "ide_lock_env_var": null, "ide_lockfile_dir": null,
               "default_model":"gpt-5.2-codex", "default_sandbox":"workspace-write",
               "default_ask_for_approval":"never", "supports":["sandbox"] },
  "gemini":  { "package_name":"@google/gemini-cli", "binary_name":"gemini",
               "login_argv": ["gemini", "auth", "login"],
               "auth_status_argv": ["gemini", "--version"],
               "ide_lock_env_var":"GEMINI_IDE_LOCK",
               "ide_lockfile_dir":"<tmpdir>/gemini/ide",
               "default_model":"gemini-2.5-pro",
               "supports":["session_id","resume","sandbox","mcp_runtime","ide_lockfile"] }
}
```

## Discriminated-union TaskSpec

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
    session_id: Optional[str] = None       # start a named session
    resume_session_id: Optional[str] = None
    max_turns: Optional[int] = Field(None, ge=1)
    max_budget_usd: Optional[float] = Field(None, ge=0)
    allowed_tools: Optional[str] = None
    permission_mode: Literal["default","acceptEdits","plan","auto"] = "acceptEdits"

class CodexTaskSpec(BaseAICliTaskSpec):
    provider: Literal["codex"] = "codex"
    sandbox: Literal["read-only","workspace-write","danger-full-access"] = "workspace-write"
    ask_for_approval: Literal["untrusted","on-request","never"] = "never"

# GeminiTaskSpec defined in v1 types.py but plugin/provider stubbed as NotImplementedError
class GeminiTaskSpec(BaseAICliTaskSpec):
    provider: Literal["gemini"] = "gemini"
    session_id: Optional[str] = None
    resume: Optional[str] = None           # "latest" | "<idx>" | "<UUID>"
    yolo: bool = False
    sandbox: bool = False

AICliTaskSpec = Annotated[
    Union[ClaudeTaskSpec, CodexTaskSpec, GeminiTaskSpec],
    Field(discriminator="provider"),
]
```

Each plugin's `Params.tasks` is hard-typed to one variant — the LLM tool schema fast-path at [ai.py:2898](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/ai.py#L2898) gets a clean per-provider schema with no `$defs`.

**v1 ships `ClaudeTaskSpec` + `CodexTaskSpec` plugins fully wired.** `GeminiTaskSpec` is in the union (and exported) so the type system, factory dispatch keys, and config JSON are ready, but `create_cli_provider("gemini")` raises `NotImplementedError("gemini provider deferred to v2")`.

## Auth model — native CLI handles its own tokens

**Principle**: each CLI ships with a working auth flow. Don't reinvent it. Don't wrap it. Don't relocate the credentials. We only **trigger** the native flow and **detect** the resulting auth state.

| Concern | What we do | What we don't do |
|---|---|---|
| Storage | CLI writes to its native location (`~/.claude/`, `~/.codex/`, `~/.gemini/`) | We **don't** copy/encrypt/relocate to `~/.claude-machina/`, our credentials.db, or anywhere else |
| Login trigger | Credentials Modal "Login with Claude/Codex/Gemini" button → WS handler spawns `provider.login_argv()` interactively (PTY or `stdio="inherit"`); user completes browser/device flow; we wait on exit | We **don't** orchestrate OAuth, exchange codes, refresh tokens, or store secrets |
| Status check | `provider.auth_status_argv()` no-op invocation; capture exit code + stderr through `provider.detect_auth_error()` | We **don't** poll `~/.claude/.credentials.json` or parse provider-internal state files |
| Refresh | The CLI handles refresh transparently | We **don't** schedule refresh jobs or manage token TTLs |
| Multi-tenancy | Single user per host (matches every dev who runs `claude`/`codex` locally) | We **don't** support per-MachinaOs-user isolated CLI auth in v1 — out of scope, v2 only if needed |
| Failure recovery | First detected `detect_auth_error()` short-circuits the batch with `error="not_authenticated"` and a hint pointing to the Credentials Modal | We **don't** retry, refresh, or attempt to re-auth mid-batch |

**Implication**: no `claude_oauth.py` / `codex_oauth.py` / `gemini_oauth.py` modules to write or maintain. The existing `claude_oauth.py` (which manages the legacy `~/.claude-machina/` install for `claude_code_service.py`) stays unchanged for back-compat with the legacy single-task path, but the new `cli_agent/` framework does not use it.

**Trade-offs accepted**:
- Anyone running MachinaOs on a host shares the host's CLI auth — same as anyone running `code .` shares VSCode's auth. Acceptable.
- We can't migrate auth between hosts via our credentials system. If users want that, they re-run `claude login` on the new host.
- Multiple parallel sessions hitting the CLI's token at once may race on refresh in rare cases. The CLIs handle this internally; if it shows up, we retry once on `detect_auth_error()` before failing the task.

## VSCode-style IDE MCP server (v1 core, no custom IPC)

VSCode Claude Code extension does, on activation:
1. Start MCP server on `127.0.0.1:<random-port>`
2. Write `~/.claude/ide/<vscode-pid>.lock` = `{"port":..., "authToken":"<32-hex>"}`
3. Spawn `claude` with `--mcp-config <tmp>` + IDE env
4. CLI reads lock, connects via Bearer `<authToken>`, gains `mcp__ide__*` tools

Gemini's VSCode companion: same shape, lock at `<tmpdir>/gemini/ide/gemini-ide-server-${PID}-${PORT}.json`.

We mirror exactly. **No custom protocol invented.**

### MachinaOs MCP tools (mirror existing capabilities)

| MCP tool | Maps to | Returns |
|---|---|---|
| `mcp__machina__getWorkspaceFiles` | `LocalShellBackend.glob/read_file` over `workspace_dir` (reuse [filesystem.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/handlers/filesystem.py)) | `{path, content?, mtime, size}` per file. `read=False` mode returns metadata only. |
| `mcp__machina__listSkills` | `SkillLoader.scan_skills()` — returns metadata only for skills connected to the parent agent node (via `BatchContext.connected_skill_names`) | List of `{name, description, allowed_tools, category}` per skill. ~100 tokens each (progressive disclosure pattern). |
| `mcp__machina__getSkill` | `SkillLoader.load_skill(name)` — returns full skill content | `{name, description, instructions, allowed_tools, metadata, scripts: {fname: content}, references: {fname: content}}`. `assets` (binary) excluded by default; available via separate `getSkillAsset` if needed. |
| `mcp__machina__getCredential` | `auth_service.get_api_key()` — gated by per-batch allowlist | `{key, value}` if name is in `BatchContext.allowed_credentials`, else 403. |
| `mcp__machina__broadcastLog` | `broadcaster.broadcast_terminal_log()` — CLI sub-tasks log to Terminal tab | `{success: true}`. Side effect: log appears in MachinaOs Terminal tab tagged with the source CLI session. |

`getDiagnostics` and `executeCode` deferred to v2.

### Skill exposure — concrete SKILL.md schema

Skills live at `server/skills/<folder>/<skill-name>/SKILL.md` with YAML frontmatter + markdown body. Reference: [`server/skills/social_agent/twitter-search-skill/SKILL.md`](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/skills/social_agent/twitter-search-skill/SKILL.md). The `SkillLoader` ([skill_loader.py:19-35](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/skill_loader.py#L19-L35)) parses to:

```python
@dataclass
class SkillMetadata:
    name: str                                    # "twitter-search-skill"
    description: str                             # one-line LLM-visible hook
    allowed_tools: list[str]                     # ["twitter_search"] — informational v1
    metadata: dict[str, Any]                     # {author, version, category, icon, color}
    path: Optional[Path]

@dataclass
class Skill:
    metadata: SkillMetadata
    instructions: str                            # full markdown body
    scripts: dict[str, str]                      # exec code samples (filename→content)
    references: dict[str, str]                   # extra docs (filename→content)
    assets: dict[str, bytes]                     # binary attachments
```

**Data source priority** (already implemented in `SkillLoader`):

1. Built-in: `server/skills/<folder>/<skill>/SKILL.md`
2. Project: `.machina/skills/` in CWD
3. User-created: database (UI-edited content takes precedence after first activation)

**`allowed_tools` field is informational in v1** — the CLI agent gets its native tool set (Claude: `Read,Edit,Bash,Glob,Grep,Write` + connected MCP tools; Codex: sandbox-restricted shell). The `allowed_tools` list is included in `listSkills` response so the LLM understands intent ("this skill expects a `twitter_search` tool"), but we don't dynamically register MachinaOs tools as MCP tools per-skill in v1. v2 candidate.

**Progressive disclosure** matches Claude Code's Skill API design: `listSkills` is cheap (metadata only), `getSkill` is on-demand. CLI agent prompt should be guided to call `listSkills` first, then `getSkill(name)` only for relevant ones — keeps token budget tight.

**`BatchContext.connected_skill_names`** is populated at `run_batch()` entry by reusing [`_collect_agent_connections()`](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/nodes/agent/_inline.py) — same logic the existing `aiAgent` uses to find skills connected to its `input-skill` handle. So the CLI agent sees exactly the skills the user wired into the parent `claude_code_agent` / `codex_agent` node.

### Per-batch token isolation

- One token per `AICliBatchPool` (`secrets.token_hex(32)`)
- Lives in memory only; registered in `_active_tokens: dict[str, BatchContext]`
- Lock files (mode 0600 on POSIX) deleted in `cleanup()`
- MCP middleware validates `Authorization: Bearer <token>` → 401 if unknown/expired
- Each tool call resolves its `BatchContext` from the bearer token to scope `workspace_dir`, `node_id`, `allowed_credentials`

## Files to change / create

All marked **v1** unless explicitly noted **v2 (deferred)**.

| File | Change | LoC |
|---|---|---|
| `server/services/cli_agent/__init__.py` | **Create (v1)**. Re-exports: `create_cli_provider`, `AICliService`, `AICliBatchPool`, `AICliSession`, task-spec classes (incl. `GeminiTaskSpec` for type completeness). | ~25 |
| `server/services/cli_agent/protocol.py` | **Create (v1)**. `AICliProvider` Protocol. Mirrors [llm/protocol.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/protocol.py). | ~90 |
| `server/services/cli_agent/types.py` | **Create (v1)**. `BaseAICliTaskSpec`, `ClaudeTaskSpec`, `CodexTaskSpec`, `GeminiTaskSpec` (Pydantic schema only — no runtime impl), `AICliTaskSpec` discriminated union, `SessionResult`, `BatchResult`. | ~140 |
| `server/services/cli_agent/config.py` | **Create (v1)**. Loads `ai_cli_providers.json` (all three entries present; gemini surfaces a `available=False` flag). Mirrors [llm/config.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/config.py). | ~60 |
| `server/services/cli_agent/factory.py` | **Create (v1)**. `create_cli_provider(name)` lazy factory; `name=="gemini"` raises `NotImplementedError("gemini provider deferred to v2")`. Mirrors [llm/factory.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/factory.py). | ~55 |
| `server/services/cli_agent/providers/anthropic_claude.py` | **Create (v1, primary)**. argv: `claude --print -p ... --output-format stream-json --include-partial-messages [--session-id|--resume] --model --max-turns --max-budget-usd --allowedTools --permission-mode --append-system-prompt`. **Auth: native** — no `CLAUDE_CONFIG_DIR` injection; CLI reads `~/.claude/`. Final = `result` event. **All Protocol features wired** — sessions, resume, budget, turns, allowed_tools, permission_mode, MCP lockfile, cost. **Binary resolution chain** (Composio pattern): (1) `shutil.which("claude")`, (2) `npx --yes @anthropic-ai/claude-code` shim. `login_argv = ["claude", "login"]`. `detect_auth_error` matches `"Please run 'claude login'"`. `canonical_usage()` extracts `{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}` from `result.usage`. `provider_data` Dict carries `reasoning_details` if present. Reference implementation. | ~200 |
| `server/services/cli_agent/providers/openai_codex.py` | **Create (v1)**. argv: `codex exec --json --model --sandbox --ask-for-approval <prompt>`. **Auth: native** — Codex reads its own `~/.codex/auth.json` after the user runs `codex login`. We don't set `OPENAI_API_KEY`. No session/resume/budget/turns. Final = `type=="complete"` or stream-end. `cost_usd=None`. Lockfile written but Codex CLI doesn't read it yet — no-op until upstream support lands. **Sandbox is the marquee feature**, exposed prominently in `CodexTaskSpec`. **Binary resolution chain**: (1) `shutil.which("codex")`, (2) `npx --yes @openai/codex` shim. `login_argv = ["codex", "login"]`. `detect_auth_error` matches HTTP 401 patterns + `"OPENAI_API_KEY not set"`. `canonical_usage()` returns zeros (Codex doesn't expose token counts in `--json`); `provider_data` Dict carries `call_id` and `response_item_id` per Codex schema. | ~170 |
| `server/services/cli_agent/providers/google_gemini.py` | **v2 (deferred)**. argv: `gemini --prompt <p> --output-format stream-json --model [--session-id] [--resume] [--yolo] [--sandbox]`. Auth `GEMINI_CLI_HOME=~/.gemini-machina`. Final = `type=="result"`. Stub left as `# TODO v2` placeholder so the factory raises a clean `NotImplementedError("gemini provider deferred to v2")`. | 0 v1 (~160 v2) |
| `server/services/cli_agent/session.py` | **Create (v1)**. `AICliSession(BaseProcessSupervisor)`. `pipe_streams=True`, `terminate_grace_seconds=5.0`, `graceful_shutdown=(sys.platform=="win32")`. `_pre_spawn`: git worktree add + write IDE lockfile. Override `_do_start` to wire NDJSON consumers + IDE env var + inject `MACHINA_PARENT_RUN_ID=<workflow_id>:<node_id>:<token_short>` (Composio pattern). **Heartbeat stale-detection**: track `(events_count, last_tool_use)` tuple per second; if frozen >60s, log warning + dump `{argv, env_keys, last_20_events, stderr_tail}` to `~/.claude-machina/logs/session-stale-<task_id>.log` (Hermes pattern). On `wait_for_completion` `TimeoutError`, dump same diagnostic to `session-timeout-<task_id>.log` before `stop()`. `cleanup`: stop + remove lockfile + worktree remove. NOT registered in global registry. | ~360 |
| `server/services/cli_agent/lockfile.py` | **Create**. `write_ide_lockfile(pid, port, token, workspace_dir, ide_name) -> Path`, `remove_ide_lockfile(path)`. Path varies per provider (Claude: `~/.claude-machina/ide/<pid>.lock`; Gemini: `<tmpdir>/gemini/ide/gemini-ide-server-<pid>-<port>.json`). 0600 on POSIX. Stale-PID sweep on startup. | ~100 |
| `server/services/cli_agent/mcp_server.py` | **Create (v1)**. FastAPI sub-app at `/mcp/ide` using official `mcp` Python SDK's `StreamableHTTPSessionManager`. Bearer-token middleware → `_active_tokens` registry. Exposes **5 tools**: `getWorkspaceFiles`, `listSkills`, `getSkill`, `getCredential`, `broadcastLog`. Each tool dereferences its `BatchContext` (set on `run_batch` entry via `_collect_agent_connections()`) to scope `workspace_dir`, `node_id`, `connected_skill_names`, and `allowed_credentials`. Skills exposed via the existing `SkillLoader` (progressive disclosure: `listSkills` returns metadata only, `getSkill` returns full markdown + scripts + references). | ~240 |
| `server/services/cli_agent/pool.py` | **Create**. `AICliBatchPool` — owns N sessions, gathers under `Semaphore(5)`. `cancel()` calls `cleanup()` on every session. Aggregates `BatchResult`. | ~120 |
| `server/services/cli_agent/service.py` | **Create**. `AICliService.run_batch(provider, params, *, node_id, workflow_id, workspace_dir, broadcaster)`. Allocates batch token, registers `BatchContext`, instantiates pool, runs, deregisters in finally. `cancel_workflow(wf)`, `cancel_node(node_id)`. | ~160 |
| `server/services/claude_code_service.py` | **Modify** to thin shim. Builds one `ClaudeTaskSpec`, calls `AICliService.run_batch("claude", ...)`. Drops 300s `wait_for`. Keeps legacy return shape. | ~50 (was ~140) |
| `server/services/cli_agent/login.py` | **Create (v1)**. Generic `run_native_login(provider) -> dict` helper. Spawns `provider.login_argv()` with stdio inherited (the CLI handles its own browser/device flow). Returns `{success, exit_code, stderr_tail}`. Used by `cli_login_<provider>` WS handlers. ~50 lines. **Replaces** the would-be `codex_oauth.py` / `gemini_oauth.py` / new `claude_oauth.py`. | ~50 |
| `server/services/cli_agent/auth_status.py` | **Create (v1)**. Generic `check_auth(provider) -> {logged_in: bool, hint: str}` helper. Runs `provider.auth_status_argv()` and feeds output to `provider.detect_auth_error()`. Used by Credentials Modal status row. ~40 lines. | ~40 |
| ~~`server/services/codex_oauth.py`~~ | **Removed from scope** — Codex CLI handles its own auth via `~/.codex/auth.json`; we don't wrap it. | 0 |
| ~~`server/services/gemini_oauth.py`~~ | **Removed from scope** (v2 also). Gemini CLI handles its own auth via `~/.gemini/`; v2 will use the same generic `run_native_login` helper, no per-provider OAuth module. | 0 |
| `server/services/claude_oauth.py` | **No change**. Legacy module used by the legacy `claude_code_service.py` shim. The new framework does not call it. Eventually deletable when the legacy shim goes. | 0 |
| `server/main.py` | **Modify**. Mount MCP sub-app: `app.mount("/mcp/ide", get_mcp_app())` in `lifespan`. Add startup stale-lockfile sweep call. | ~8 |
| `server/nodes/agent/claude_code_agent.py` | **Modify**. `Params.tasks: list[ClaudeTaskSpec]`. `execute_op`: verify git repo, build tasks (with legacy-`prompt` fallback to single-task), call `run_batch("claude", ...)`, emit `phase=batch_started`/`batch_complete`. | ~140 |
| `server/nodes/agent/codex_agent.py` | **Create (v1)**. `CodexAgentNode` with `Params.tasks: list[CodexTaskSpec]`. Visual: orange/black icon, group `("agent","ai")`. Sandbox dropdown surfaced as primary param. | ~130 |
| `server/nodes/agent/gemini_cli_agent.py` | **v2 (deferred)**. `GeminiCliAgentNode` with `Params.tasks: list[GeminiTaskSpec]`. Visual: blue/yellow icon. | 0 v1 (~120 v2) |
| `server/nodes/visuals.json` | **Modify (v1)**. Add `codexAgent` icon+color. (v2: add `geminiCliAgent`.) | ~5 |
| `server/config/credential_providers.json` | **Modify (v1)**. Add `_cli_base` abstract entry (`kind: "native_cli"`, no token storage — just a status hook + login button) + two concretes (`claude_code`, `codex_cli`) extending it. (v2 adds `gemini_cli`.) | ~50 |
| `server/routers/websocket.py` | **Modify (v1)**. Add **generic** `cli_login` and `cli_auth_status` handlers (one pair total, dispatched by `provider` field) that delegate to `cli_agent/login.py` and `cli_agent/auth_status.py`. **Replaces** what would have been per-provider `codex_oauth_login` / `claude_oauth_login` etc. | ~40 |
| `server/services/workflow.py` | **Modify**. `stop_execution` → `get_ai_cli_service().cancel_workflow(workflow_id)` alongside existing process cancel. | ~10 |
| `server/services/_supervisor/*` | **No change**. Used as-is. | 0 |
| `server/services/temporal/activities.py` | **No change**. Heartbeats already fire per WS broadcast. | 0 |
| `server/pyproject.toml` | **Modify**. Add `mcp>=1.0` to deps (pinned). | ~2 |
| `server/tests/services/test_cli_agent_providers.py` | **Create (v1)**. Claude + Codex: `headless_argv` shape, `parse_event` schema fidelity (vendored NDJSON), `event_to_session_result` reconstruction. Heaviest coverage on Claude (full feature set). | ~250 |
| `server/tests/services/test_cli_agent_session.py` | **Create (v1)**. Generic session: 3-task parallel happy path with mocked `anyio.open_process`; cancel mid-batch; worktree cleanup on exception; lockfile written/removed. | ~280 |
| `server/tests/services/test_cli_agent_mcp.py` | **Create (v1)**. MCP server: bearer-token auth (valid/invalid/expired), per-tool scoping, lock file format matches VSCode convention, cleanup of stale PIDs. Uses `mcp` SDK test client. | ~220 |
| `server/tests/nodes/test_claude_code_agent.py` | **Create/modify (v1)**. Single-task back-compat + 3-task parallel via Claude. Heavy coverage: sessions, resume, budget, turns, allowed_tools, permission_mode, MCP tool callback. | ~220 |
| `server/tests/nodes/test_codex_agent.py` | **Create (v1)**. 3-task parallel happy path; assert no `--max-budget-usd` / `--max-turns` / `--session-id` in argv; sandbox `read-only`/`workspace-write`/`danger-full-access` flags propagate; `--ask-for-approval` honored. | ~160 |
| `server/tests/nodes/test_gemini_cli_agent.py` | **v2 (deferred)**. 3-task parallel; `--session-id` roundtrip; `--resume latest`; yolo flag. | 0 v1 (~150 v2) |
| `client/src/components/AIAgentNode.tsx` | **No change**. Renders the three new agent kinds via `useNodeSpec(type)`; the array-of-rows `tasks` editor is auto-generated from JSON Schema. | 0 |

**Net code delta (v1)**: ~2200 lines added, ~90 removed (-240 from dropping `codex_oauth.py` + per-provider OAuth WS handlers; +90 for generic `login.py` / `auth_status.py` helpers). Two plugins (Claude refactor + Codex new), two providers, MCP server (VSCode-pattern), session/pool/service, generic native-auth shim. Supervisor framework reused as-is. New runtime dep: `mcp>=1.0`.

**v1 → v2 follow-up (Gemini, ~430 LoC)**:
- `providers/google_gemini.py` (replace stub) — ~160
- `nodes/agent/gemini_cli_agent.py` — ~120
- `tests/nodes/test_gemini_cli_agent.py` — ~150
- Update `factory.py` (drop `NotImplementedError`)
- Add `geminiCliAgent` to `visuals.json` and `gemini_cli` entry in `credential_providers.json`
- (No `gemini_oauth.py`. No new WS handlers — generic `cli_login`/`cli_auth_status` already cover it.)

## AICliSession sketch

```python
# server/services/cli_agent/session.py (abridged)
class AICliSession(BaseProcessSupervisor):
    pipe_streams = True
    terminate_grace_seconds = 5.0
    graceful_shutdown = (sys.platform == "win32")

    def __init__(self, *, provider, task, repo_root, workspace_dir,
                 node_id, workflow_id, broadcaster, defaults,
                 mcp_port, batch_token):
        super().__init__()
        self._provider = provider
        self._task = task
        self._task_id = task.task_id or f"t_{uuid.uuid4().hex[:8]}"
        self._worktree_dir = workspace_dir / node_id / f"wt_{self._task_id}"
        self._branch = task.branch or f"machina/{self._task_id}"
        self._broadcaster = broadcaster
        self._defaults = defaults
        self._mcp_port = mcp_port
        self._batch_token = batch_token
        self._lockfile_path: Optional[Path] = None
        self._events, self._stderr = [], []
        self._exit_code: Optional[int] = None
        self._repo_root, self._node_id, self._workflow_id = repo_root, node_id, workflow_id

    @property
    def label(self): return f"AICliSession_{self._provider.name}_{self._task_id}"

    def binary_path(self): return self._provider.binary_path()
    def argv(self):        return self._provider.headless_argv(self._task, defaults=self._defaults)
    def cwd(self):         return self._worktree_dir

    def env(self):
        # Inherit parent env so the CLI finds its own auth in ~/.claude/, ~/.codex/, ~/.gemini/
        # We do NOT inject CLAUDE_CONFIG_DIR / GEMINI_CLI_HOME — the CLI uses its native location.
        e = {**os.environ, "PYTHONUNBUFFERED": "1"}
        if self._lockfile_path and self._provider.ide_lock_env_var:
            e[self._provider.ide_lock_env_var] = str(self._lockfile_path)
        # Composio pattern: parent-run-ID propagation for MCP correlation
        e["MACHINA_PARENT_RUN_ID"] = (
            f"{self._workflow_id}:{self._node_id}:{self._batch_token[:8]}"
        )
        return e

    async def _pre_spawn(self):
        # 1. git worktree
        self._worktree_dir.parent.mkdir(parents=True, exist_ok=True)
        result = await anyio.run_process(
            ["git", "-C", str(self._repo_root), "worktree", "add",
             str(self._worktree_dir), "-b", self._branch], check=False)
        if result.returncode != 0:
            raise RuntimeError(f"git worktree add failed: {result.stderr.decode()}")

        # 2. VSCode-style IDE lock file (CLI auto-discovers MachinaOs MCP)
        if self._provider.supports("ide_lockfile"):
            from .lockfile import write_ide_lockfile
            self._lockfile_path = write_ide_lockfile(
                pid=os.getpid(), port=self._mcp_port,
                token=self._batch_token,
                workspace_dir=self._worktree_dir,
                ide_name=self._provider.name,
            )

    async def _do_start(self):
        binary = self.binary_path()
        if not binary.exists():
            raise FileNotFoundError(f"{self.label} binary not found at {binary}")
        await self._pre_spawn()
        kwargs = {"cwd": str(self.cwd()), "env": self.env(),
                  "stdout": subprocess.PIPE, "stderr": subprocess.PIPE}
        if sys.platform == "win32" and self.graceful_shutdown:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        self._proc = await anyio.open_process(self.argv(), **kwargs)
        self._drain_tasks = [
            asyncio.create_task(self._consume_stdout(self._proc.stdout)),
            asyncio.create_task(self._consume_stderr(self._proc.stderr)),
        ]

    async def _consume_stdout(self, stream):
        async for raw in stream:
            text = raw.decode("utf-8", errors="replace").strip()
            if not text: continue
            event = self._provider.parse_event(text)
            if event is None: continue
            self._events.append(event)
            await self._on_event(event)

    async def _on_event(self, event):
        if self._provider.is_final_event(event):
            await self._broadcaster.update_node_status(self._node_id, "executing", {
                "phase":"ai_cli_subtask", "task_id":self._task_id,
                "provider":self._provider.name, "status":"succeeded",
                **{k: event.get(k) for k in
                   ("total_cost_usd","duration_ms","num_turns","session_id")
                   if event.get(k) is not None},
            })
        else:
            msg = event.get("message") or event.get("text") or json.dumps(event)
            await self._broadcaster.broadcast_terminal_log(
                {"source":f"{self._provider.name}:{self._task_id}",
                 "level":"info", "message":msg[:500]})

    async def _consume_stderr(self, stream):
        async for raw in stream:
            text = raw.decode("utf-8", errors="replace").rstrip()
            if not text: continue
            self._stderr.append(text)
            await self._broadcaster.broadcast_terminal_log(
                {"source":f"{self._provider.name}:{self._task_id}",
                 "level":"error", "message":text})

    async def wait_for_completion(self, timeout: int) -> dict:
        try:
            await asyncio.wait_for(self._proc.wait(), timeout=timeout)
            self._exit_code = self._proc.returncode
        except asyncio.TimeoutError:
            await self.stop()
            return self._build_result(success=False, error=f"timeout after {timeout}s")
        return self._build_result(success=(self._exit_code == 0))

    async def cleanup(self):
        await self.stop()
        if self._lockfile_path:
            from .lockfile import remove_ide_lockfile
            remove_ide_lockfile(self._lockfile_path)
        await anyio.run_process(
            ["git", "-C", str(self._repo_root), "worktree", "remove", "--force",
             str(self._worktree_dir)], check=False)

    def _build_result(self, *, success, error=None):
        base = self._provider.event_to_session_result(
            self._events, "\n".join(self._stderr), self._exit_code or -1)
        base.update({"task_id":self._task_id, "branch":self._branch,
                     "worktree_path":str(self._worktree_dir),
                     "success": success and base.get("success", True),
                     "error": error or base.get("error")})
        return base
```

## Output contract

```json
{
  "tasks": [{
    "task_id": "t_<8hex>", "session_id": "<UUID|null>",
    "provider": "claude|codex|gemini",
    "prompt": "...", "branch": "machina/t_<8hex>",
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
      "reasoning_details": "...",   // Anthropic only
      "call_id": "...",             // Codex only
      "extra_content": [...]        // Gemini only (v2)
    },
    "success": true, "error": null
  }],
  "summary": {
    "n_tasks": 3, "n_succeeded": 2, "n_failed": 1,
    "total_cost_usd": 1.23,
    "wall_clock_ms": 19002,
    "budget_remaining_usd": 18.77
  },
  "provider": "claude|codex|gemini",
  "timestamp": "2026-05-02T12:00:00Z"
}
```
`canonical_usage` normalizes vendor token-counting (Hermes pattern). `provider_data` carries vendor-only metadata that doesn't fit the shared schema.
`cost_usd`/`num_turns` = `null` for codex/gemini. `summary.total_cost_usd`/`budget_remaining_usd` = `null` if any task is non-Claude.

## Status broadcast events

| Phase | When | Payload |
|---|---|---|
| `batch_started` | run_batch entry | `{provider, n_tasks, max_parallel, isolation:"worktree"}` |
| `ai_cli_subtask` | per-task partial | `{task_id, provider, status:"running", message, cost_usd?, num_turns?}` |
| `ai_cli_subtask` | per-task final | `{task_id, provider, status:"succeeded"|"failed", cost_usd?, duration_ms, num_turns?, error?}` |
| `batch_complete` | aggregator finish | `{provider, n_succeeded, n_failed, total_cost_usd?, wall_clock_ms}` |

Plus `broadcast_terminal_log(source=f"{provider}:{task_id}", level)` on every NDJSON line.

## Error handling

- **Per-task failure** → `_run_one` catches → `SessionResult(success=False, error=...)`. Batch continues.
- **Per-task timeout** → `asyncio.TimeoutError` → `session.stop()` (terminate_then_kill 5s) → `error="timeout after Ns"`.
- **Auth missing** → `provider.detect_auth_error()` on first session's stderr/exit_code. First detection short-circuits remaining tasks: `error="not_authenticated"` with hint `"Open Credentials Modal and click 'Login with <Provider>'"`. The CLI handles re-auth itself via its own `<provider> login` flow; we don't.
- **CLI not installed** → `binary_path()` `FileNotFoundError` from [process.py:74-75](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/_supervisor/process.py#L74-L75) → pool catches → `error="cli_not_installed"` with hint pointing at credentials modal.
- **Not a git repo** → early `git rev-parse --git-dir` check in plugin's `execute_op` → `BatchResult(error="working_directory_not_git_repo")` before pool construction.
- **Worktree creation fails** → `_pre_spawn` raises → that task only fails; siblings continue.
- **Budget exhaustion (Claude)** → track `running_total_cost`; refuse to acquire semaphore for pending tasks once exceeded; in-flight tasks have CLI's own `--max-budget-usd` cap.
- **Cancellation** → `WorkflowService.stop_execution` → `service.cancel_workflow(wf)` → `pool.cancel()` → per-session `cleanup()` → `BaseSupervisor.stop()` → `terminate_then_kill` → `git worktree remove --force` + lockfile delete.
- **MCP 401** → CLI calls our MCP with bad/expired token → 401 → CLI sees tool error → continues with built-ins.
- **Lockfile leak on hard crash** → startup sweep deletes `~/.claude-machina/ide/*.lock` whose PID is no longer alive (mirrors VSCode behavior).

## Reused (DO NOT duplicate)

- [_supervisor/base.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/_supervisor/base.py) — `BaseSupervisor` lock + lifecycle
- [_supervisor/process.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/_supervisor/process.py) — `BaseProcessSupervisor` (override `_do_start`)
- [_supervisor/util.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/_supervisor/util.py) — `kill_tree`, `terminate_then_kill`
- [whatsapp/_runtime.py:26-116](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/nodes/whatsapp/_runtime.py#L26-L116) — reference subclass shape
- ~~[claude_oauth.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/claude_oauth.py)~~ — **NOT used** by the new framework. Legacy module for the legacy `claude_code_service.py` shim only. New framework uses native CLI auth (no wrapping).
- [llm/protocol.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/protocol.py), [factory.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/factory.py), [config.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/llm/config.py) — Protocol+factory+config blueprint
- [credential_registry.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/credential_registry.py) — `extends` deep-merge
- [handlers/tools.py:678](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/handlers/tools.py#L678) — 4000-char truncation
- [status_broadcaster.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/status_broadcaster.py) — `update_node_status`, `broadcast_terminal_log`
- [workflow.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/workflow.py) — `_get_workspace_dir`
- [agent/_inline.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/nodes/agent/_inline.py) — `collect_agent_connections()` for skill prompt
- [ai.py:2898](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/ai.py#L2898) — plugin Params doubles as LLM tool schema
- [skill_loader.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/skill_loader.py) — `SkillLoader.scan_skills()` (metadata, ~100 tokens/skill) reused by `mcp__machina__listSkills`; `SkillLoader.load_skill(name)` (full content with scripts/references) reused by `mcp__machina__getSkill`. Reference SKILL.md: [`server/skills/social_agent/twitter-search-skill/SKILL.md`](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/skills/social_agent/twitter-search-skill/SKILL.md)
- [auth.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/auth.py) — `AuthService.get_api_key()` reused by `mcp__machina__getCredential` (allowlisted)
- [handlers/filesystem.py](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/handlers/filesystem.py) — `LocalShellBackend` reused by `mcp__machina__getWorkspaceFiles`
- VSCode lock file format reference: `~/.claude/ide/<pid>.lock` = `{port, authToken, workspaceFolders, ideName, transport}` — mirrored exactly

## Verification

In order:

1. **Worktree**: `git worktree list` shows `cli-agent-framework` on `feat/cli-agent-framework`.
2. **Unit tests (v1)**:
   - `uv run pytest tests/services/test_cli_agent_providers.py -v`
   - `uv run pytest tests/services/test_cli_agent_session.py -v`
   - `uv run pytest tests/services/test_cli_agent_mcp.py -v`
   - `uv run pytest tests/nodes/test_claude_code_agent.py tests/nodes/test_codex_agent.py -v`
   - Add: `test_factory_gemini_raises_not_implemented` — calling `create_cli_provider("gemini")` raises `NotImplementedError`.
3. **Plugin contract**: `uv run pytest tests/test_plugin_contract.py tests/test_node_spec.py -k "claude or codex"` — clean per-provider schemas, no `$defs`.
4. **Live single-task back-compat (Claude)**: workflow with one `claude_code_agent`, legacy `prompt="say hello"`. Confirm `summary.n_tasks==1`, `summary.total_cost_usd != null`.
5. **Live 3-task parallel (Claude)**: `tasks=[{prompt:"echo A"},{prompt:"echo B"},{prompt:"echo C"}]`. Three distinct `claude:<task_id>` Terminal streams interleaved. Three distinct session_ids. Three worktrees created and removed. `summary.wall_clock_ms < sum(duration_ms)`.
6. **Live 3-task parallel (Codex)**: `codex_agent` node. Confirm `summary.total_cost_usd == null`, no `--max-budget-usd` / `--max-turns` / `--session-id` in argv. Verify `--sandbox workspace-write` and `--ask-for-approval never` defaults applied.
7. **Live cancel** (Claude or Codex): start long batch, click Stop. Confirm child processes die within 5s; worktrees removed; lockfiles removed.
8. **Live tool-mode (Claude)**: aiAgent → input-tools → claude_code_agent. Prompt: "use the claude_code tool to refactor utils.py and tests/test_utils.py in parallel." Confirm structured envelope; response truncated at 4000.
9. **Live resumption (Claude)**: capture `tasks[0].session_id`, run again with `tasks=[{resume_session_id:<captured>, prompt:"add error handling"}]`. Confirm context preservation.
10. **Live MCP discovery (Claude)**: with a Claude task running, `cat ~/.claude-machina/ide/<pid>.lock` and confirm format `{port, url, authToken, workspaceFolders, ideName:"machinaos", transport}`. Stream-json shows an `mcp__machina__*` tool invocation. MCP server logs the call with the per-batch token.
10a. **Skill exposure**: connect `twitter-search-skill` to a `claude_code_agent` node, run a task. Confirm CLI invokes `mcp__machina__listSkills` (returns 1 skill with `name="twitter-search-skill"`, `description`, `allowed_tools=["twitter_search"]`). Then CLI invokes `mcp__machina__getSkill("twitter-search-skill")` and receives full instructions markdown + any scripts/references. Connect a second skill (e.g., `python-skill`) and confirm only the connected skills appear in `listSkills` (scoping via `BatchContext.connected_skill_names`).
10b. **Credential allowlist**: configure batch with `allowed_credentials=["openai"]`. CLI calls `mcp__machina__getCredential("openai")` → returns key. CLI calls `mcp__machina__getCredential("anthropic")` → 403.
11. **Live MCP auth rejection**: `curl -H "Authorization: Bearer <wrong>" http://127.0.0.1:3010/mcp/ide/...` → 401.
12. **Live MCP cleanup**: lockfiles removed from `~/.claude-machina/ide/` after batch (success and cancel paths).
13. **Stale lockfile sweep**: kill server mid-batch, restart. Confirm leftover lockfile (PID dead) is deleted on startup.
14. **Codex sandbox enforcement**: Codex task with `sandbox:"read-only"` attempting to write a file → CLI rejects → captured in stderr, surfaces as `success=false` with sandbox error.
15. **Heartbeat stale-detection**: mock a session that emits no events for >60s; confirm `~/.claude-machina/logs/session-stale-<task_id>.log` is written with last-events + stderr tail.
16. **Timeout diagnostic dump**: set `timeout_seconds=5` on a long task; on timeout, confirm `session-timeout-<task_id>.log` contains argv, env keys (no secret values), last 20 events, stderr tail.
17. **Binary resolution chain**: temporarily move/rename the system `claude` binary; run a Claude task; confirm fallback to `npx --yes @anthropic-ai/claude-code` succeeds. Restore.
18. **Parent run-ID env**: with a Claude task running, MCP server logs show `MACHINA_PARENT_RUN_ID=<workflow>:<node>:<token8>` correlating each tool call to the batch.
19. **Native auth — login flow**: log out (`rm ~/.claude/.credentials.json` or equivalent). Open Credentials Modal → click "Login with Claude" → confirm `claude login` opens browser/device flow → complete it → confirm Credentials Modal status flips to "Connected" via `cli_auth_status` polling.
20. **Native auth — status check**: with `claude` logged in, `cli_auth_status` returns `{logged_in: true}`. Manually corrupt `~/.claude/.credentials.json` → `cli_auth_status` returns `{logged_in: false, hint: "Run claude login"}`.
21. **Native auth — error short-circuit**: log out, then run a 3-task batch. First task fails fast with `error="not_authenticated"`; remaining 2 tasks short-circuit with the same error (no spawn). Hint message is surfaced in the BatchResult.
22. **Auth env not injected**: `printenv | grep -i 'CLAUDE_CONFIG_DIR\|GEMINI_CLI_HOME'` inside a running task's env (via `mcp__machina__broadcastLog` reflection or `/proc/<pid>/environ` peek) confirms we're **not** setting these vars; CLI uses its native location.
23. **Smoke**: `uv run pytest -x -q` over the full server suite — no regressions from `claude_code_service.py` slimming.

## External orchestrator patterns (Hermes + Composio source review)

Researched against fresh clones at `D:/tmp/hermes-agent` (NousResearch) and `D:/tmp/composio` (ComposioHQ). Findings shaped the v1 design.

### What we copy

| Pattern | Source | Apply to |
|---|---|---|
| **`ProviderTransport` ABC + `provider_data` Dict** for vendor-specific metadata (Anthropic `reasoning_details`, Codex `call_id`/`response_item_id`, Gemini `extra_content`) without polluting the shared schema | Hermes [`agent/transports/base.py`](D:/tmp/hermes-agent/agent/transports/base.py), [`types.py`](D:/tmp/hermes-agent/agent/transports/types.py) | `AICliProvider.event_to_session_result()` returns `{...shared, provider_data: {<vendor-specific>}}`. Our Protocol stays thin; weird per-CLI metadata lives under `provider_data`. |
| **`CanonicalUsage` normalization** across vendor token-counting shapes (Anthropic vs Codex vs OpenAI handle cache tokens differently) | Hermes [`agent/usage_pricing.py`](D:/tmp/hermes-agent/agent/usage_pricing.py) | When `event_to_session_result` builds the result, normalize usage into `{input, output, cache_read, cache_write, reasoning, request_count}` — feed to existing [`services/pricing.py`](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/pricing.py) for cost. |
| **Heartbeat stale-detection** — track `(iteration, current_tool)` tuple; if unchanged for N cycles, log warning + dump diagnostic | Hermes [`tools/delegate_tool.py:1290-1357`](D:/tmp/hermes-agent/tools/delegate_tool.py) | Add to `AICliSession`: track `(events_seen, last_tool_use)` tuple per second; if frozen >60s, dump stderr buffer + last 5 events to `~/.claude-machina/logs/session-stale-<task_id>.log`. |
| **Timeout diagnostic dump** — on hard timeout, write stack/config/last-events to log file (issue ref: hermes #14726) | Hermes [`tools/delegate_tool.py:1437-1442`](D:/tmp/hermes-agent/tools/delegate_tool.py) | `wait_for_completion` `TimeoutError` branch writes `{argv, env_keys, last_20_events, stderr_tail}` to `~/.claude-machina/logs/session-timeout-<task_id>.log` before `stop()`. |
| **Binary resolution chain**: shipped assets → bundled npm pkg → PATH → npx fallback | Composio [`ts/packages/cli/src/services/run-subagent-acp.ts:66-124`](D:/tmp/composio/ts/packages/cli/src/services/run-subagent-acp.ts) | `provider.binary_path()` tries: (1) `<isolated_auth_dir>/npm/node_modules/.bin/<binary>`, (2) `shutil.which(<binary>)`, (3) `npx --yes <package_name>` shim. Mirrors what `claude_oauth.py` already partially does for Claude. |
| **Parent run-ID propagation via env var** for request tracing (lets MCP tool calls correlate to the parent batch) | Composio [`run.cmd.ts:494`](D:/tmp/composio/ts/packages/cli/src/commands/run.cmd.ts) (`COMPOSIO_CLI_PARENT_RUN_ID`) | Inject `MACHINA_PARENT_RUN_ID=<workflow_id>:<node_id>:<batch_token_short>` into every spawned CLI's env. MCP server logs this with each tool call. |
| **JSON-RPC framing pattern** for subprocess RPC (when MCP doesn't fit) | Hermes [`agent/copilot_acp_client.py:418-478`](D:/tmp/hermes-agent/agent/copilot_acp_client.py) | Reference for v2 if we ever wrap a CLI that doesn't speak stream-json. v1 uses stream-json directly (per-CLI native format). |

### What we deliberately don't copy

| Pattern | Source | Why we skip |
|---|---|---|
| **ACP adapter binaries** (`claude-code-acp`, `codex-acp`) — Composio spawns dedicated wrapper binaries that translate the CLI's native protocol into Zed's Agent Client Protocol | Composio [`run-subagent-acp.ts:533`](D:/tmp/composio/ts/packages/cli/src/services/run-subagent-acp.ts) | Adds a translation layer + extra dependency for each CLI. Stream-json is the official Anthropic format and Gemini's documented JSON output — direct invocation is cleaner. ACP is right for editors that need to speak one protocol to N agents; we're the opposite (one app, many CLIs). |
| **Naive `subprocess.Popen` lifecycle** without locks/kill-tree | Hermes [`copilot_acp_client.py:348-354`](D:/tmp/hermes-agent/agent/copilot_acp_client.py) — `terminate; sleep 2; kill` (parent only) | We already have `BaseProcessSupervisor` with locked idempotent start/stop, recursive `kill_tree`, Windows `CTRL_BREAK_EVENT`. Strictly better. |
| **MCP-over-stdio for structured output collection** — Composio runs an MCP server *inside* the child (not the parent) so children write structured output via tool call | Composio [`run-subagent-output-mcp.ts`](D:/tmp/composio/ts/packages/cli/src/services/run-subagent-output-mcp.ts) | Inverts the call direction. Useful for tools that don't have native structured output, but Claude/Codex/Gemini already emit stream-json. Skip. |
| **Task-scoped filesystem tracking** (no real isolation, just bookkeeping) | Hermes [`tools/delegate_tool.py:1403`](D:/tmp/hermes-agent/tools/delegate_tool.py) | Our git-worktree-per-task is process-level isolation enforced by the kernel (different cwd, different file system view). Strictly stronger. |
| **Tool-tag-based capability filtering** (`destructiveHint`, `readOnlyHint`) for risk gating | Composio [`ts/packages/core/src/types/mcp.types.ts`](D:/tmp/composio/ts/packages/core/src/types/mcp.types.ts) | Codex's native `--sandbox read-only|workspace-write|danger-full-access` already does this at the kernel level; tag-based hints are a soft signal that doesn't enforce. We use Codex's sandbox flag directly. |
| **No retry loop** — failed children return error, not retried | Hermes (same pattern) | Aligns with our continue-on-error settle policy. Match. |
| **`max_concurrent_children=3`** | Hermes [`hermes_cli/config.py:934`](D:/tmp/hermes-agent/hermes_cli/config.py) | We use 5; their 3 is also fine. Difference is cosmetic. |

### Explicit non-finding

Neither Hermes nor Composio writes a VSCode-style IDE lockfile (`~/.claude/ide/<pid>.lock` shape). Our v1 lockfile-discovery design is original among open-source orchestrators we surveyed and matches what the **VSCode Claude Code extension itself** does — i.e., we're cloning the upstream IDE pattern, not Hermes/Composio's pattern.

## v2 follow-up — Gemini activation

After v1 ships and stabilizes, Gemini activation is a small, mechanical PR:

1. Replace `providers/google_gemini.py` stub with full implementation (argv builder for `--prompt`/`--session-id`/`--resume`/`--yolo`/`--sandbox`; `parse_event` keyed on the `JsonStreamEventType` enum from `nonInteractiveCli.ts`; `is_final_event` = `type=="result"`; `event_to_session_result` extracts `session_id` + `stats.duration_ms`, sets `cost_usd=None`; `login_argv = ["gemini", "auth", "login"]`; `detect_auth_error` matches exit code 1 / `FatalAuthenticationError`).
2. Drop the `NotImplementedError` branch in `factory.py`.
3. Create `server/nodes/agent/gemini_cli_agent.py` with `Params.tasks: list[GeminiTaskSpec]`.
4. Add `geminiCliAgent` to `server/nodes/visuals.json`.
5. Add `gemini_cli` entry to `server/config/credential_providers.json` (extending `_cli_base`).
6. (No new WS handlers — generic `cli_login`/`cli_auth_status` already dispatch by provider field.)
7. Create `server/tests/nodes/test_gemini_cli_agent.py` (mirrors `test_codex_agent.py` shape; adds session/resume tests).
8. Vendored NDJSON fixture from the JS source for parser tests.

No changes to `protocol.py`, `types.py`, `session.py`, `pool.py`, `service.py`, `mcp_server.py`, `lockfile.py`, `login.py`, or `auth_status.py` — the v1 abstraction absorbs Gemini cleanly. **No `gemini_oauth.py` ever** — Gemini CLI handles its own auth via `~/.gemini/`.

## Risks / open considerations

- **`drain_stream` not used** — we override `_do_start`; drain task list replaced wholesale; `stop()` still cancels them via `self._drain_tasks` ([process.py:119-120](D:/startup/projects/machinaos-worktrees/credentials-scaling-v2/server/services/_supervisor/process.py#L119-L120)).
- **`--include-partial-messages`** assumes recent Claude CLI; detect via `claude --help | grep partial` once at module init, downgrade to plain `stream-json` if absent.
- **Codex auth** — Codex reads `~/.codex/auth.json` after `codex login`. We **don't** set `OPENAI_API_KEY` ourselves; the CLI handles its own auth. If the user prefers env-based auth (e.g., `CODEX_API_KEY_ENV_VAR`), they can set it in their shell — we inherit env via `os.environ`.
- **Gemini cost** — token stats only, no USD. v1 reports `cost_usd=null`; follow-up could compute via `services/pricing.py`.
- **Concurrent OAuth refresh** at sem=5 — the CLIs handle their own refresh internally. If a race causes a transient auth error, our session retries once on `detect_auth_error()` before failing. Acceptable for v1.
- **Native CLI auth = single user per host** — anyone with shell access on the host has access to the host's CLI auth, same as VSCode/`code .`. v1 doesn't isolate per-MachinaOs-user. If multi-tenant deployment becomes a need, v2 can introduce optional per-user `HOME` redirects (the old `~/.claude-machina/` pattern) gated by a config flag.
- **Discriminator + LLM tool schema** — Pydantic generates `oneOf`+`discriminator` JSON Schema, handled by most LLMs. Per-plugin `Params.tasks` is hard-typed to one variant so the fast-path schema stays clean.
- **Worktree leak on hard crash** — covered by startup sweep (mirrors VSCode lock-file behavior).
- **Three OAuth modules duplicate ~60% of `claude_oauth.py`** — defer factoring; wait for the third concrete to validate the abstraction.
- **Codex/Gemini final-event detection** is best-effort by event-type name; tests pin to vendored NDJSON streams to catch CLI schema drift.
- **MCP SDK is pre-1.0-stable** — pin a known-good version in `pyproject.toml`. Isolate the surface in `mcp_server.py` so an SDK breaking change touches one file.
- **Codex MCP discovery incomplete** — Codex CLI doesn't yet auto-read VSCode-style lockfiles. v1 still writes them (cheap); when Codex lands support, no code change needed.
- **Heavy bias toward Claude** — Claude provider is the reference implementation for the Protocol; if a Protocol method ever needs a feature only Claude has, prefer adding it to the Protocol with sensible defaults for other providers rather than designing for the lowest common denominator.
- **Gemini deferred but designed-for** — `GeminiTaskSpec` ships in `types.py` and the discriminator union in v1 so the JSON Schema fast-path doesn't need re-deriving when v2 lands. The factory raises `NotImplementedError` for gemini; tests assert this contract.
- **MCP multi-tenancy** — multiple parallel batches must not see each other's tokens or workspace. Per-batch token registry keyed by bearer token; missing/expired → 401. Tested.
