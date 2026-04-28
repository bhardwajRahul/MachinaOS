# Parameter Panel — Per-Node UI Reference

> **Generated from `main` branch** (`dd8b253` era, pre-plugin-migration).
> This is the authoritative spec for what the parameter panel renders for each node.
> Use this document to verify / restore functionality on `feature/credentials-scaling-v2`
> after the plugin migration's dead-code pass.

**109 nodes documented** across 26 source files. Every node that ships in the component palette has a section here.

---

## Table of Contents

- [Legend](#legend)
- [Shared Conventions](#shared-conventions)
- **Workflow & triggers**
  - [Workflow (2)](#workflow-2) — `start`, `taskTrigger`
  - [Scheduler (2)](#scheduler-2) — `timer`, `cronScheduler`
- **AI brain**
  - [AI Chat Models (9)](#ai-chat-models-9)
  - [AI Agents (18)](#ai-agents-18)
  - [Skill & Memory (2)](#skill--memory-2)
- **Tools, code, filesystem**
  - [Tool Nodes (5)](#tool-nodes-5)
  - [Search Nodes (3)](#search-nodes-3)
  - [Code Executors (3)](#code-executors-3)
  - [Filesystem (4)](#filesystem-4)
  - [Process (1)](#process-1)
- **Messaging**
  - [WhatsApp (3)](#whatsapp-3)
  - [Telegram (2)](#telegram-2)
  - [Twitter/X (4)](#twitterx-4)
  - [Social Unified (2)](#social-unified-2)
  - [Email (3)](#email-3)
  - [Chat (2)](#chat-2)
- **Web & services**
  - [Google Workspace (7)](#google-workspace-7)
  - [Location (3)](#location-3)
  - [Browser (1)](#browser-1)
  - [Crawlee (1)](#crawlee-1)
  - [Apify (1)](#apify-1)
  - [Proxy (3)](#proxy-3)
  - [Utility (6)](#utility-6)
  - [Document Pipeline (6)](#document-pipeline-6)
- **Android**
  - [Android Services (16)](#android-services-16)
- **Appendices**
  - [Appendix A — Specialized-selector dispatch rules](#appendix-a--specialized-selector-dispatch-rules)
  - [Appendix B — MiddleSection branching table](#appendix-b--middlesection-branching-table)
  - [Appendix C — Post-migration checklist](#appendix-c--post-migration-checklist)

---

## Legend

**Visual components** (from `Dashboard.tsx` node-type mapping):

| Component | Used for |
|---|---|
| `StartNode` | `start` only — distinctive shape for workflow entry |
| `TriggerNode` | Event-driven triggers (`webhookTrigger`, `*Receive`, `taskTrigger`) |
| `AIAgentNode` | All agents + core + specialized + team leads (18 types) via `AGENT_CONFIGS` |
| `ModelNode` | AI chat models; provider auto-detected |
| `ToolkitNode` | `masterSkill` (split-panel skill aggregator) |
| `SquareNode` | Default for everything else — tools, services, workflow nodes |
| `GenericNode` | Fallback when no specialized component matches |

**Middle-section branches** (triggered in `MiddleSection.tsx`):

| Branch | Condition (baseline) | What it renders |
|---|---|---|
| `standard` | default | ParameterRenderer iterates over `properties[]` |
| `masterSkillEditor` | `name === 'masterSkill'` | Full-panel `MasterSkillEditor` replaces params |
| `memoryPanel` | `name === 'simpleMemory'` | Standard params + Clear Memory button + Token Usage panel |
| `codeEditorLayout` | `name === 'pythonExecutor' \|\| 'javascriptExecutor'` (baseline BUG: `typescriptExecutor` missing) | Code editor flex:3 + Console Output collapsible |
| `toolSchemaEditor` | `name ∈ TOOL_NODE_TYPES` (baseline: only `androidTool`, `calculatorTool`, `currentTimeTool`, `duckduckgoSearch` — BUG: `taskManager`, `writeTodos` missing) | Standard params + `ToolSchemaEditor` below |
| `agentWithSkills` | `name ∈ AGENT_WITH_SKILLS_TYPES` (all 18 agents) | Standard params + Token Usage (when memory connected) + Connected Skills section |
| `locationPanel` | `name === 'gmaps_create'` | Routes to `LocationParameterPanel` instead of `ParameterPanel` entirely (at `Dashboard.tsx` level) |

**Specialized-selector dispatch** (ParameterRenderer.tsx picks by `parameter.name`):

| Parameter name | Selector triggered |
|---|---|
| `group_id` | `GroupIdSelector` — loads WhatsApp groups via WebSocket |
| `channel_jid` | `ChannelJidSelector` — loads WhatsApp newsletter channels |
| `senderNumber` | `SenderNumberSelector` — loads group members (depends on `group_id`) |
| Others | Standard input field based on `type` |

**Pydantic → INodeProperties translation patterns** (for post-migration plugin classes):

| Frontend pattern | Suggested Pydantic pattern |
|---|---|
| `type: 'options'` with static array | `Literal['a', 'b', 'c']` |
| `type: 'options'` with `loadOptionsMethod` | `str` + backend-served options via NodeSpec |
| `type: 'string'` + `typeOptions.editor: 'code'` | `str = Field(..., json_schema_extra={"editor": "code", "editorLanguage": "python"})` |
| `type: 'string'` + `typeOptions.rows > 1` | `str = Field(..., json_schema_extra={"rows": 4})` |
| `type: 'string'` + `typeOptions.password: true` | `SecretStr` or `str = Field(..., json_schema_extra={"password": true})` |
| `type: 'number'` + min/max | `int = Field(..., ge=1, le=100)` |
| `type: 'json'` | `Dict[str, Any]` or nested `BaseModel` |
| `type: 'collection'` | `Optional[NestedModel]` with optional fields |
| `type: 'fixedCollection'` | `List[NestedModel]` |
| `displayOptions.show: {x: ['a']}` | `json_schema_extra={"displayOptions": {"show": {"x": ["a"]}}}` on the field |
| `group: [..., 'tool']` | `usable_as_tool: ClassVar[bool] = True` on the plugin class |

---

## Shared Conventions

### STANDARD_PARAMETERS (AI chat models)

Defined in `client/src/factories/baseChatModelFactory.ts`. Every `createBaseChatModel(config)` invocation picks from this shared set; per-provider configs override defaults or add extras (`safetySettings`, `reasoningEffort`, `thinkingBudget`, etc.).

Shared keys: `temperature`, `maxTokens`, `topP`, `topK`, `frequencyPenalty`, `presencePenalty`, `timeout`, `maxRetries`, `thinkingEnabled`, `thinkingBudget`, `reasoningEffort`, `reasoningFormat`.

### AI_AGENT_PROPERTIES (agents)

`specializedAgentNodes.ts` exports `AI_AGENT_PROPERTIES` — the shared 5-field block used by core agents (`aiAgent`, `chatAgent`) and **all 13 specialized agents**. Fields: `provider`, `model` (dynamic via `loadOptionsMethod`), `prompt`, `systemMessage`, `options` collection. Individual agents differ only in defaults (icon, color, systemMessage preamble, default skill folder).

Team leads (`orchestrator_agent`, `ai_employee`, `deep_agent`) extend AI_AGENT_PROPERTIES with `teamMode`, `maxConcurrent`, `maxTurns`, and the extra `input-teammates` handle (handle is topology, not a parameter).

### PROXY_PARAMETERS (HTTP/scraper nodes)

Shared across `httpRequest`, `httpScraper`, `proxyRequest`, and `crawleeScraper` via `useProxy: boolean` gate. When true, extra fields appear: `proxyProvider` (string), `proxyCountry` (string ISO), `sessionType` (`rotating`|`sticky`), `stickyDuration` (number, only when sticky).

---

## Workflow (2)

### `start` — Start

**Source:** `client/src/nodeDefinitions/workflowNodes.ts:9-37`
**Visual component:** StartNode
**Group:** `['workflow']`
**Middle-section branch:** standard
**Special editor:** none
**Specialized selectors:** none
**Dual-purpose (tool):** no

**Properties** (1):

| # | name | displayName | type | default | required | typeOptions | displayOptions.show | notes |
|---|---|---|---|---|---|---|---|---|
| 1 | initialData | Initial Data | string | `{}` | — | rows: 6 | — | JSON data passed to connected nodes |

**Output:** single `main` handle.
**Expected post-migration uiHints:** `{}` (minimal).

---

### `taskTrigger` — Task Completed

**Source:** `client/src/nodeDefinitions/workflowNodes.ts:41-92`
**Visual component:** TriggerNode
**Group:** `['trigger', 'workflow']`
**Middle-section branch:** standard with filters
**Special editor:** none
**Specialized selectors:** none
**Dual-purpose (tool):** no

**Properties** (4):

| # | name | displayName | type | default | required | typeOptions | displayOptions.show | notes |
|---|---|---|---|---|---|---|---|---|
| 1 | task_id | Task ID Filter | string | `''` | — | — | — | Optional: specific task UUID |
| 2 | agent_name | Agent Name Filter | string | `''` | — | — | — | Optional: partial match |
| 3 | status_filter | Status Filter | options | `all` | — | — | — | `all` \| `completed` \| `error` |
| 4 | parent_node_id | Parent Node ID | string | `''` | — | — | — | Filter by parent agent |

**Output:** `main` handle payload: `{task_id, status, agent_name, result\|error, parent_node_id, timestamp}`.
**Expected Pydantic patterns:** `status_filter: Literal['all','completed','error']`; all 4 filters optional (`Optional[str]`).

---

## Scheduler (2)

### `timer` — Timer

**Source:** `client/src/nodeDefinitions/schedulerNodes.ts:6-61`
**Visual component:** SquareNode
**Group:** `['utility', 'workflow', 'tool']`
**Middle-section branch:** standard
**Dual-purpose (tool):** yes (dual output `tool`)

**Properties** (2):

| # | name | displayName | type | default | required | typeOptions | displayOptions.show | notes |
|---|---|---|---|---|---|---|---|---|
| 1 | duration | Duration | number | 5 | ✓ | min: 1, max: 3600 | — | Wait interval |
| 2 | unit | Unit | options | `seconds` | — | — | — | `seconds` \| `minutes` \| `hours` |

**Expected Pydantic patterns:** `unit: Literal['seconds','minutes','hours']`; `duration: int = Field(..., ge=1, le=3600)`.

---

### `cronScheduler` — Cron Scheduler

**Source:** `client/src/nodeDefinitions/schedulerNodes.ts:64-234`
**Visual component:** SquareNode
**Group:** `['trigger', 'workflow', 'tool']`
**Middle-section branch:** conditional (7-way displayOptions on `frequency`)
**Dual-purpose (tool):** yes

**Properties** (9, heavily conditional):

| # | name | displayName | type | default | required | typeOptions | displayOptions.show | notes |
|---|---|---|---|---|---|---|---|---|
| 1 | frequency | Duration | options | `minutes` | — | — | — | `seconds`\|`minutes`\|`hours`\|`days`\|`weeks`\|`months`\|`once` |
| 2 | interval | Interval (s) | number | 30 | — | — | `frequency: ['seconds']` | 5-59 |
| 3 | interval_minutes | Interval (m) | number | 5 | — | — | `frequency: ['minutes']` | 1-59 |
| 4 | interval_hours | Interval (h) | number | 1 | — | — | `frequency: ['hours']` | 1-23 |
| 5 | daily_time | At Time | options | `09:00` | — | — | `frequency: ['days']` | 11 HH:MM presets |
| 6 | weekday | On Day | options | `1` | — | — | `frequency: ['weeks']` | 0=Sunday … 6=Saturday |
| 7 | weekly_time | At Time | options | `09:00` | — | — | `frequency: ['weeks']` | HH:MM presets |
| 8 | month_day | On Day | options | `1` | — | — | `frequency: ['months']` | 1-28, L |
| 9 | timezone | Timezone | options | `UTC` | — | — | — | 7 presets |

**Expected Pydantic patterns:** `frequency: Literal[...]`; separate `interval_*` fields kept distinct to preserve per-frequency defaults and ranges.

---

## AI Chat Models (9)

All 9 models instantiated via `createBaseChatModel(config)` factory; they share STANDARD_PARAMETERS with per-provider overrides.

### `openaiChatModel` — OpenAI Chat Model

**Source:** `aiModelNodes.ts:12-49` · **Visual:** ModelNode · **Group:** `['model']` · **Middle-section:** standard
**Dynamic options:** `model` loads via `loadOptionsMethod: 'getModels'` depending on `[provider]`

**Properties** (~13):

| name | type | default | typeOptions | displayOptions | notes |
|---|---|---|---|---|---|
| model | string | `''` | dynamicOptions | — | Depends on provider credentials |
| prompt | string | `'{{ $json.message }}'` | rows: 4 | — | Main input |
| options | collection | `{}` | — | — | systemMessage + the below advanced fields |
| temperature | number | 0.7 | min: 0, max: 2 | — | o-series auto-set to 1 |
| maxTokens | number | 4096 | min: 1, max: 128000 | — | OpenAI 128K max |
| topP | number | 1 | min: 0, max: 1 | — | |
| frequencyPenalty | number | 0 | min: -2, max: 2 | — | |
| presencePenalty | number | 0 | min: -2, max: 2 | — | |
| responseFormat | options | `text` | — | — | `text` \| `json_object` |
| timeout | number | 60000 | min: 1000, max: 180000 | — | ms |
| maxRetries | number | 2 | min: 0, max: 5 | — | |
| thinkingEnabled | boolean | false | — | — | Extended reasoning |
| reasoningEffort | options | `medium` | — | `thinkingEnabled: [true]` | `minimal`\|`low`\|`medium`\|`high` |

**Expected Pydantic patterns:** `provider: Literal['openai']`; `responseFormat: Literal['text','json_object']`; `reasoningEffort: Literal['minimal','low','medium','high']`.

---

### `anthropicChatModel` — Claude Chat Model

**Source:** `aiModelNodes.ts:51-81` · **Visual:** ModelNode · **Group:** `['model']`

**Properties** (11): same shape as OpenAI but with Anthropic-specific params.

| Key differences from OpenAI |
|---|
| `temperature` max: 1 (not 2) |
| no `frequencyPenalty`/`presencePenalty` |
| adds `topK` (min: 1, max: 100) |
| `thinkingBudget` (min: 1024, max: 16000) shown when `thinkingEnabled: [true]` |
| `maxTokens` must exceed `thinkingBudget` when thinking on |

**Expected Pydantic patterns:** `provider: Literal['anthropic']`; `thinkingBudget: Optional[int] = Field(None, ge=1024, le=16000)`.

---

### `geminiChatModel` — Gemini Chat Model

**Source:** `aiModelNodes.ts:83-125` · **Visual:** ModelNode

**Properties** (~12): OpenAI-shape + `safetySettings: Literal['default','strict','permissive']`, `thinkingBudget` (like Anthropic). Defaults: `temperature=0.9`, `topP=0.95`.

---

### `openrouterChatModel` — OpenRouter

**Source:** `aiModelNodes.ts:127-144` · **Visual:** ModelNode

**Properties** (10): STANDARD set. No thinking. `maxTokens` max: 200000 (varies per routed model).

---

### `groqChatModel` — Groq

**Source:** `aiModelNodes.ts:146-163` · **Visual:** ModelNode

**Properties** (10): STANDARD set + `reasoningFormat: Literal['parsed','hidden']` shown when `thinkingEnabled: [true]` (Qwen3-32b only).

---

### `cerebrasChatModel` — Cerebras

**Source:** `aiModelNodes.ts:165-182` · **Visual:** ModelNode

**Properties** (10): STANDARD set + `thinkingBudget` (Qwen-3-235b). `temperature` max: 1.5.

---

### `deepseekChatModel` — DeepSeek

**Source:** `aiModelNodes.ts:184-204` · **Visual:** ModelNode

**Properties** (11): STANDARD set. No thinking toggle (always-on for `deepseek-reasoner`). `maxTokens` up to 64K.

---

### `kimiChatModel` — Kimi

**Source:** `aiModelNodes.ts:206-225` · **Visual:** ModelNode

**Properties** (8): STANDARD set. Fixed temperature per model (0.6 instant, 1.0 thinking). 256K context, 96K output.

---

### `mistralChatModel` — Mistral

**Source:** `aiModelNodes.ts:227-246` · **Visual:** ModelNode

**Properties** (8): STANDARD set. Temperature 0-1.5. No thinking. 256K context.

---

## AI Agents (18)

All 18 agents use `AIAgentNode` visual component, trigger the **`agentWithSkills`** middle-section branch, and share `AI_AGENT_PROPERTIES` (provider + model + prompt + systemMessage + options collection with thinking/reasoning). Middle-section adds Token Usage panel (when memory connected) + Connected Skills collapsible section.

Per-agent differences are **icon + color + default `systemMessage` preamble + default skill folder**; parameters are identical except where noted below.

### `aiAgent` — AI Agent

**Source:** `aiAgentNodes.ts:14-160` · **Group:** `['agent']`

**Properties** (6): provider, model, prompt (`'{{ $json.chatInput }}'`), systemMessage, options collection containing temperature/maxTokens/thinkingEnabled/thinkingBudget/reasoningEffort.

**Expected post-migration uiHints:** `{hasSkills: true}` via shared `STD_AGENT_HINTS`.

---

### `chatAgent` — Zeenie

**Source:** `aiAgentNodes.ts:163-304` · **Group:** `['agent']`

Same as `aiAgent` except `prompt` default is empty string (auto-infers from connected-upstream-node output).

---

### Specialized agents (13)

Each uses `AI_AGENT_PROPERTIES` verbatim — identical 6 params. Only icon/color/default systemMessage differ.

| Type | Source line | Icon | Color | Specialization |
|---|---|---|---|---|
| `android_agent` | `specializedAgentNodes.ts:165-177` | 🤖 | green | Android device control |
| `coding_agent` | `:180-192` | 💻 | cyan | Code execution, filesystem |
| `web_agent` | `:195-207` | 🌐 | pink | Browser automation, HTTP |
| `task_agent` | `:210-222` | 📋 | purple | Task automation, scheduling |
| `social_agent` | `:225-237` | 📱 | green | WhatsApp, Telegram, social |
| `travel_agent` | `:240-252` | ✈️ | orange | Location, maps, scheduling |
| `tool_agent` | `:255-267` | 🔧 | yellow | Multi-tool orchestration |
| `productivity_agent` | `:270-282` | ⏰ | cyan | Google Workspace, notes |
| `payments_agent` | `:285-297` | 💳 | green | Payment processing |
| `consumer_agent` | `:300-312` | 🛒 | purple | Customer support, orders |
| `autonomous_agent` | `:315-327` | 🎯 | purple | Code Mode, progressive discovery |
| `rlm_agent` | `:401-454` | 🧠 | orange | REPL-based recursive LM (adds `maxIterations`, `maxDepth`, `maxBudget`, `maxTimeout`, `verbose`) |
| `claude_code_agent` | `:456-528` | (Claude logo) | — | Claude Code CLI — does NOT inherit AI_AGENT_PROPERTIES. Distinct schema: `prompt`, `model: Literal['claude-opus-4-6','claude-sonnet-4-6','claude-haiku-4-5']`, `systemPrompt`, `allowedTools`, `maxTurns`, `maxBudgetUsd`, `workingDirectory` |

All 13 (except `claude_code_agent`) emit `{hasSkills: true}` via `STD_AGENT_HINTS` inheritance.

---

### Team leads (3)

Extend `AI_AGENT_PROPERTIES` and add a `input-teammates` handle (topology-level).

| Type | Source | Extra params |
|---|---|---|
| `orchestrator_agent` | `:330-359` | `teamMode: Literal['','parallel','sequential']` (default empty) |
| `ai_employee` | `:362-398` | `teamMode: Literal['parallel','sequential']` + `maxConcurrent: int (1-20, default 5)` |
| `deep_agent` | `:531-556` | `maxTurns: int (1-500, default 200)` — LangChain DeepAgents runtime |

Expected uiHints: `{hasSkills: true}` plus the team handle declared via `team_lead_agent_handles()` / `deep_agent_handles()` in the Python side.

---

## Skill & Memory (2)

### `masterSkill` — Master Skill

**Source:** `skillNodes.ts:15-47` · **Visual:** ToolkitNode · **Group:** `['tool']`
**Middle-section branch:** `masterSkillEditor` (FULL-PANEL replacement — no standard params shown)
**Special editor:** MasterSkillEditor (split panel with folder dropdown + skill list + markdown editor)

**Properties** (2):

| name | type | default | notes |
|---|---|---|---|
| skillFolder | string | `'assistant'` | Subfolder under `server/skills/` |
| skillsConfig | json | `{}` | `{[skillName]: {enabled, instructions, isCustomized}}` |

**Expected post-migration uiHints:** `{isMasterSkillEditor: true, isToolPanel: true, hideRunButton: true}`.
**Expected Pydantic patterns:** `skillFolder: str`; `skillsConfig: Dict[str, Dict[str, Any]]`.

---

### `simpleMemory` — Simple Memory

**Source:** `aiAgentNodes.ts:307-374` · **Visual:** ModelNode · **Group:** `['tool', 'memory']`
**Middle-section branch:** `codeEditorLayout` + memoryPanel — Clear Memory button rendered
**Special editor:** CodeEditor (markdown for `memoryContent`)

**Properties** (5):

| # | name | displayName | type | default | typeOptions | displayOptions.show | notes |
|---|---|---|---|---|---|---|---|
| 1 | sessionId | Session ID (Override) | string | `''` | — | — | Auto-derives from connected agent ID if empty |
| 2 | windowSize | Window Size | number | 100 | min: 1, max: 100 | — | Message pairs in short-term |
| 3 | memoryContent | Conversation History | string | `'# Conversation History\n\n*No messages yet.*\n'` | rows: 15, editor: 'code', editorLanguage: 'markdown' | — | Full-panel markdown editor |
| 4 | longTermEnabled | Enable Long-Term Memory | boolean | false | — | — | Vector DB archive |
| 5 | retrievalCount | Retrieval Count | number | 3 | min: 1, max: 10 | `longTermEnabled: [true]` | Semantic fetches |

**Expected post-migration uiHints:** `{isMemoryPanel: true, hasCodeEditor: true, hideRunButton: true}`.

---

## Tool Nodes (5)

All 5 use `SquareNode` visual and `['tool', 'ai']` group. Baseline TOOL_NODE_TYPES missing `taskManager` and `writeTodos` — a pre-existing bug where ToolSchemaEditor never rendered for them.

### `calculatorTool`

**Source:** `toolNodes.ts:14-48` · **Middle-section:** standard + ToolSchemaEditor (if in TOOL_NODE_TYPES)

**Properties** (2): `toolName` (default `calculator`), `toolDescription` (multi-line description).
**Expected uiHints:** `{isToolPanel: true, hideRunButton: true}`.

---

### `currentTimeTool`

**Source:** `toolNodes.ts:51-93`

**Properties** (3): `toolName` (`get_current_time`), `toolDescription`, `timezone` (default `UTC`).

---

### `duckduckgoSearch`

**Source:** `toolNodes.ts:96-138`

**Properties** (3): `toolName` (`web_search`), `toolDescription`, `maxResults` (number, 1-10, default 5).

---

### `taskManager` (dual output: `tool` + `main`)

**Source:** `toolNodes.ts:141-224` · **Baseline bug:** NOT in `TOOL_NODE_TYPES` → ToolSchemaEditor never renders

**Properties** (5): `toolName`, `toolDescription`, `operation: Literal['list_tasks','get_task','mark_done']`, conditional `task_id` (for get/mark), conditional `status_filter` (for list).

---

### `writeTodos` (dual output: `tool` + `main`)

**Source:** `toolNodes.ts:227-268` · **Baseline bug:** NOT in `TOOL_NODE_TYPES` → ToolSchemaEditor never renders

**Properties** (2): `toolName` (`write_todos`), `toolDescription`.
**Tool schema output:** list of `{content: str, status: Literal['pending','in_progress','completed']}`.

---

## Search Nodes (3)

All dual-purpose (workflow node + AI tool, dual output: `tool` + `main`). Group: `['search', 'tool']`. **None appear in baseline `TOOL_NODE_TYPES`** — matches `duckduckgoSearch` asymmetry.

### `braveSearch`

**Source:** `searchNodes.ts:15-110`

**Properties** (7): `toolName`, `toolDescription`, `query` (required), `maxResults: int (1-100, default 10)`, `country: str`, `searchLang: str`, `safeSearch: Literal['off','moderate','strict']`.

---

### `serperSearch`

**Source:** `searchNodes.ts:113-211`

**Properties** (7): Same skeleton + `searchType: Literal['search','news','images','places']`, `language: str`. No `searchLang`.

---

### `perplexitySearch`

**Source:** `searchNodes.ts:214-316`

**Properties** (7): `toolName`, `toolDescription`, `query`, `model: Literal['sonar','sonar-pro','sonar-reasoning','sonar-reasoning-pro']`, `searchRecencyFilter: Literal['','month','week','day','hour']`, `returnImages: bool`, `returnRelatedQuestions: bool`.

---

## Code Executors (3)

All dual-purpose (group `['code', 'tool']`), CodeEditor via `typeOptions.editor: 'code'`, trigger `codeEditorLayout` branch (Console Output collapsible section). **Baseline bug:** `isCodeExecutorNode` check misses `typescriptExecutor` → it never got code-editor layout on main.

### `pythonExecutor`

**Source:** `codeNodes.ts:5-27`

**Properties** (1): `code: string` with `typeOptions: {rows: 5, editor: 'code', editorLanguage: 'python'}`.
**Execution:** `input_data` dict available; must set `output` variable; `print()` → console. Libs: math, json, datetime, re, random.

---

### `javascriptExecutor`

**Source:** `codeNodes.ts:29-51`

**Properties** (1): `code` with `editorLanguage: 'javascript'`.
**Execution:** Node.js server on port 3020; must set `output`; `console.log` → console.

---

### `typescriptExecutor`

**Source:** `codeNodes.ts:53-76`

**Properties** (1): `code` with `editorLanguage: 'typescript'`.
**Execution:** Same Node.js server; tsx transpilation; type-safe `input_data`.

---

## Filesystem (4)

All dual-purpose (`['utility', 'tool']`). Backend: `deepagents.backends.LocalShellBackend`, `virtual_mode=True` restricts to per-workflow workspace.

### `fileRead`

**Source:** `filesystemNodes.ts:5-45`

**Properties** (3): `file_path` (required), `offset: int ≥ 0`, `limit: int 1-10000 (default 100)`.

---

### `fileModify`

**Source:** `filesystemNodes.ts:47-117`

**Properties** (6): `operation: Literal['write','edit']`, `file_path` (required), conditional `content` (write), `old_string`/`new_string`/`replace_all` (edit).

---

### `shell`

**Source:** `filesystemNodes.ts:119-152`

**Properties** (2): `command` (required, rows:3), `timeout: int 1-300 (default 30)`. **Sandboxed (no system PATH)** — use `processManager` for npm/python/node.

---

### `fsSearch`

**Source:** `filesystemNodes.ts:154-205`

**Properties** (4): `mode: Literal['ls','glob','grep']`, `path` (default `.`), conditional `pattern` (glob/grep), conditional `file_filter` (grep only).

---

## Process (1)

### `processManager`

**Source:** `processNodes.ts:11-102` · Dual-purpose `['utility', 'tool']`

**Properties** (7, operation-heavy):

| # | name | type | default | displayOptions.show | notes |
|---|---|---|---|---|---|
| 1 | toolName | string | `process_manager` | — | |
| 2 | toolDescription | string | (multi-line) | — | |
| 3 | operation | options | `start` | — | `start`\|`stop`\|`restart`\|`send_input`\|`list`\|`get_output` |
| 4 | name | string | `''` | `operation: ['start','stop','restart','send_input','get_output']` | Process identifier |
| 5 | command | string | `''` | `operation: ['start']` | Shell command (required for start) |
| 6 | working_directory | string | `''` | `operation: ['start']` | Defaults to workflow workspace |
| 7 | text | string | `''` | `operation: ['send_input']` | Input to stdin |

**Expected uiHints:** `{operationSelector: true, streamOutput: true}` (terminal streaming).

---

## WhatsApp (3)

### `whatsappSend` (41 fields, dual-purpose)

**Source:** `whatsappNodes.ts:79` · Group: `['whatsapp', 'tool']`
**Specialized selectors:** GroupIdSelector (`group_id`), ChannelJidSelector (`channel_jid`)

<details>
<summary>Expand 41-property table</summary>

| # | name | type | default | required | displayOptions.show | notes |
|---|---|---|---|---|---|---|
| 1 | recipient_type | options | `self` | — | — | `self`\|`phone`\|`group`\|`channel` |
| 2 | phone | string | `''` | ✓ | `recipient_type: [phone]` | No `+` prefix |
| 3 | group_id | string | `''` | ✓ | `recipient_type: [group]` | GroupIdSelector; JID `xxx@g.us` |
| 4 | channel_jid | string | `''` | ✓ | `recipient_type: [channel]` | ChannelJidSelector; newsletter JID |
| 5 | message_type | options | `text` | — | — | 8 types; channels only support 5 |
| 6 | message | string | `''` | ✓ | `message_type: [text]` | — |
| 7 | format_markdown | boolean | true | — | `message_type: [text]` | LLM markdown → WhatsApp native |
| 8 | media_source | options | `base64` | — | `message_type: [image,video,audio,document,sticker]` | `base64`\|`file`\|`url` |
| 9-11 | media_data / file_path / media_url | — | — | ✓ (one of) | Cascades on `media_source` | Mutually exclusive |
| 12 | mime_type | string | `''` | — | `message_type: [media]` | Auto-detected if empty |
| 13 | caption | string | `''` | — | `message_type: [image,video,document]` | — |
| 14 | filename | string | `''` | — | `message_type: [document]` | — |
| 15-18 | latitude/longitude/location_name/address | number/string | — | ✓ (lat/lng) | `message_type: [location]` | — |
| 19-20 | contact_name/vcard | string | — | ✓ | `message_type: [contact]` | vCard 3.0 |
| 21 | is_reply | boolean | false | — | — | Reply mode toggle |
| 22-24 | reply_message_id / reply_sender / reply_content | string | — | ✓ (id/sender) | `is_reply: [true]` | Quote preview |

</details>

**Expected Pydantic patterns:** `Literal[...]` for recipient_type / message_type / media_source; heavy `json_schema_extra={"displayOptions": ...}` declarations.
**Expected uiHints:** `{isToolPanel: true, categoryKey: 'whatsapp'}`.

---

### `whatsappReceive` (trigger)

**Source:** `whatsappNodes.ts:415` · Group: `['whatsapp', 'trigger']`
**Specialized selectors:** GroupIdSelector, SenderNumberSelector, ChannelJidSelector
**Dynamic options:** `getWhatsAppGroups`, `getGroupMembers` (depends on `group_id`), `getWhatsAppChannels`

**Properties** (10):

| name | type | default | displayOptions.show | notes |
|---|---|---|---|---|
| messageTypeFilter | options | `all` | — | 8 types |
| filter | options | `all` | — | `all`\|`self`\|`any_contact`\|`contact`\|`group`\|`channel`\|`keywords` |
| contactPhone / group_id / senderNumber / channel_jid / keywords | string | — | based on `filter` | Cascaded |
| ignoreOwnMessages | boolean | true | `filter: [all,any_contact,...]` | |
| forwardedFilter | options | `all` | — | `all`\|`only_forwarded`\|`ignore_forwarded` |
| includeMediaData | boolean | false | — | Memory-intensive |

---

### `whatsappDb` (54 fields across 18 operations)

**Source:** `whatsappNodes.ts:650` · Group: `['whatsapp', 'tool']` · Dual-purpose
**Specialized selectors:** GroupIdSelector, ChannelJidSelector

<details>
<summary>Expand operations and fields summary</summary>

Operation selector drives 18 conditional branches:
- `chat_history` (+ `chat_type`, `phone`/`group_id`, `group_filter`, `sender_phone`, `message_filter`, `limit`, `offset`, `include_media_data`)
- `search_groups`, `get_group_info`, `get_contact_info`, `list_contacts`, `check_contacts`
- `list_channels`, `get_channel_info`, `channel_messages` (+ pagination, date range, media filter, search), `channel_stats`
- `channel_follow`, `channel_unfollow`, `channel_create` (+ `channel_name`, `channel_description`, `picture`)
- `channel_mute`, `channel_mark_viewed`, `newsletter_react`, `newsletter_live_updates`
- `contact_profile_pic`

</details>

**Expected uiHints:** `{isToolPanel: true, categoryKey: 'whatsapp'}`.

---

## Telegram (2)

### `telegramSend` (13 fields, dual-purpose)

**Source:** `telegramNodes.ts:26` · Group: `['social', 'tool']`

**Properties** (13): `recipient_type: Literal['self','user','group']`, `chat_id`, `message_type: Literal['text','photo','document','location','contact']`, text/media fields cascaded, `parse_mode: Literal['Auto','','HTML','Markdown','MarkdownV2']` (Auto converts LLM markdown to Telegram HTML), `silent`, `reply_to_message_id`.

---

### `telegramReceive` (trigger)

**Source:** `telegramNodes.ts:234` · Group: `['social', 'trigger']`

**Properties** (10): `contentTypeFilter` (11 types), `senderFilter: Literal['all','self','private','group','supergroup','channel','specific_chat','specific_user','keywords']`, cascaded filter-specific fields, `ignoreBots` (conditional).

---

## Twitter/X (4)

All use XDK SDK via `usable_as_tool = True`.

### `twitterSend` (8 fields)

**Source:** `twitterNodes.ts:26` · Group: `['social', 'tool']`

**Properties** (8): `action: Literal['tweet','reply','retweet','quote','like','unlike','delete']`, `text`, `tweet_id`, `include_media` + `media_urls`, `include_poll` + `poll_options` + `poll_duration` (5 min - 7 days).

---

### `twitterReceive` (trigger)

**Source:** `twitterNodes.ts:163` · Group: `['social', 'trigger']`

**Properties** (7): `trigger_type: Literal['mentions','search','timeline']`, `search_query`, `user_id`, `filter_retweets`, `filter_replies`, `poll_interval: int 15-3600 (default 60)`.

---

### `twitterSearch` (7 fields, dual-purpose)

**Source:** `twitterNodes.ts:248` · Group: `['social', 'tool']`

**Properties** (7): `query`, `max_results: int (10-100, default 10)` (X API minimum), `sort_order: Literal['recency','relevancy']`, `start_time`, `end_time`, `include_metrics`, `include_author`.

---

### `twitterUser` (5 fields, dual-purpose)

**Source:** `twitterNodes.ts:347` · Group: `['social', 'tool']`

**Properties** (5): `operation: Literal['me','by_username','by_id','followers','following']`, conditional `username`/`user_id`, conditional `max_results: int (1-1000)` for followers/following.

---

## Social Unified (2)

### `socialReceive` (normalizer, 9 fields)

**Source:** `socialNodes.ts:76` · Group: `['social']` · 4 distinct outputs: message/media/contact/metadata

**Properties** (9): `channelFilter` (11 platforms incl. whatsapp/telegram/discord/slack/signal/sms/webchat/email/matrix/teams), `messageTypeFilter` (11 types), `senderFilter: Literal['all','any_contact','contact','group','keywords']`, cascaded filter fields, bools `ignoreOwnMessages`/`ignoreBots`/`includeMediaData`.

---

### `socialSend` (42 fields — largest single node, dual-purpose)

**Source:** `socialNodes.ts:216` · Group: `['social', 'tool']` · 5 named inputs (main/message/media/contact/metadata)

<details>
<summary>Expand 42-field summary</summary>

`channel` (10 platforms, no `all`), `recipientType` (5 types: phone/group/channel/user/chat), cascaded recipient IDs, `threadId`, `messageType` (11 types incl. poll/buttons/list), cascaded per-type fields:
- text: message, `format: Literal['plain','markdown','html']`
- media: `mediaSource: Literal['url','base64','file']`, mediaUrl/mediaData/filePath, mimeType, caption, filename
- location: lat/lng/name/address
- contact: name/phone/vcard
- poll: question/options/allowMultiple
- buttons: buttonText/buttons (JSON array)
- list: listTitle/listButtonText/listSections (JSON)

Plus: `replyToMessage` + replyMessageId/replyToCurrent, `audioAsVoice`, `disablePreview`, `silent`, `protectContent`.

</details>

**Expected uiHints:** `{isToolPanel: true, categoryKey: 'social', multiInputs: ['message','media','contact','metadata']}`.

---

## Email (3)

Use Himalaya CLI; 7 provider presets.

### `emailSend` (8 fields, dual-purpose)

**Source:** `emailNodes.ts:35` · Group: `['email', 'tool']`

**Properties** (8): `provider: Literal['gmail','outlook','yahoo','icloud','protonmail','fastmail','custom']`, `to`, `subject`, `body`, `cc`, `bcc`, `body_type: Literal['text','html']`.

---

### `emailRead` (12 fields, dual-purpose)

**Source:** `emailNodes.ts:60`

**Properties** (12): `provider`, `operation: Literal['list','search','read','folders','move','delete','flag']`, conditional `folder`/`query`/`message_id`/`target_folder`/`flag`/`flag_action`, pagination `page`/`page_size`.

---

### `emailReceive` (trigger, 5 fields)

**Source:** `emailNodes.ts:99`

**Properties** (5): `provider`, `folder` (default `INBOX`), `poll_interval: int 30-3600 (default 60)`, `filter_query`, `mark_as_read`.

---

## Chat (2)

### `chatSend`

**Source:** `chatNodes.ts:9` · Group: `['chat']`

**Properties** (5): `host`, `port`, `session_id`, `api_key`, `content`. JSON-RPC 2.0 WebSocket.

---

### `chatHistory`

**Source:** `chatNodes.ts:74` · Group: `['chat']`

**Properties** (5): `host`, `port`, `session_id`, `api_key`, `limit`.

---

## Google Workspace (7)

All 7 use SquareNode + `['google', 'tool']` group + `operation` selector with operation-specific displayOptions.

### `gmail` (19 fields)

**Source:** `googleWorkspaceNodes.ts:48-236`

Operation `send`/`search`/`read`. `account_mode: Literal['owner','customer']` + conditional `customer_id`. Send: to/cc/bcc/subject/body_type/body. Search: query/max_results/include_body. Read: message_id/format.

---

### `gmailReceive` (6 fields, trigger)

**Source:** `googleWorkspaceNodes.ts:242-302`

Poll-based. `account_mode`, `filter_query: str (default 'is:unread')`, `label_filter: Literal['all','INBOX','IMPORTANT','STARRED','SENT','DRAFT']`, `mark_as_read`, `poll_interval: int 30-3600`.

---

### `calendar` (28 fields)

**Source:** `googleWorkspaceNodes.ts:308-606`

`operation: Literal['create','list','update','delete']`. Per-op cascaded fields: title/start/end/description/location/attendees/timezone/reminder_minutes (create); start_date/end_date/max_results/single_events/order_by (list); event_id + update_* fields (update); send_updates (delete).

---

### `drive` (27 fields)

**Source:** `googleWorkspaceNodes.ts:612-869`

`operation: Literal['upload','download','list','share']`. Upload: file_url/file_content/filename/mime_type/folder_id/description. Download: file_id/output_format. List: query/file_types/max_results/order_by/folder_id. Share: file_id/email/role (`reader`/`commenter`/`writer`)/send_notification/message.

---

### `sheets` (13 fields)

**Source:** `googleWorkspaceNodes.ts:875-1019`

`operation: Literal['read','write','append']`. `spreadsheet_id`, `range` (A1 notation), `value_render_option` (read), `major_dimension` (read), `values` (JSON, write/append), `value_input_option`, `insert_data_option` (append).

---

### `tasks` (19 fields)

**Source:** `googleWorkspaceNodes.ts:1025-1220`

`operation: Literal['create','list','complete','update','delete']`. Per-op: title/notes/due_date (create); show_completed/show_hidden/max_results (list); task_id + update_* (update).

---

### `contacts` (26 fields)

**Source:** `googleWorkspaceNodes.ts:1226-1505`

`operation: Literal['create','list','search','get','update','delete']`. Per-op: first_name/last_name/email/phone/company/job_title/notes (create); page_size/sort_order/page_token (list); query/search_page_size (search); resource_name + update_* (update).

---

## Location (3)

### `gmaps_create` (6 fields)

**Source:** `locationNodes.ts:17-99` · Group: `['location', 'service']`
**Middle-section branch:** `locationPanel` — routes to `LocationParameterPanel` entirely (not MiddleSection)
**Special editor:** LocationPanelLayout + MapSelector

**Properties** (5): `lat`/`lng` (coordinate picker), `zoom: int 0-21 (default 13)`, `map_type_id: Literal['ROADMAP','SATELLITE','HYBRID','TERRAIN']`, `options` collection.
**Credentials:** `googleMapsApi`.
**Expected uiHints:** `{showLocationPanel: true}`.

---

### `gmaps_locations` (5 fields, dual-purpose)

**Source:** `locationNodes.ts:102-220` · Group: `['location', 'service', 'tool']`

**Properties** (5): `service_type: Literal['geocode','reverse_geocode']`, conditional `address` (geocode) or `lat`/`lng` (reverse_geocode), `options` collection (multiOptions for result_types, location_types).

---

### `gmaps_nearby_places` (5 fields, dual-purpose)

**Source:** `locationNodes.ts:223-459`

**Properties** (5): `lat`/`lng`, `radius: int 1-50000`, `type: Literal[...]` (90+ Google Places types), `options` collection.

---

## Browser (1)

### `browser` (32 fields, dual-purpose)

**Source:** `browserNodes.ts:12-303` · Group: `['browser', 'tool']`

**Properties** (32):

<details>
<summary>Expand operation selector + per-op fields</summary>

`operation: Literal['navigate','click','type','fill','screenshot','snapshot','get_text','get_html','eval','wait','scroll','select','console','errors','batch']` with per-operation cascades:
- navigate: `url`
- click/type/fill/get_text/get_html/wait/select: `selector` (CSS or `@eN` ref from snapshot)
- type: `text`; fill/select: `value`
- screenshot: `fullPage`, `annotate`, `screenshotFormat: Literal['png','jpeg']`, conditional `screenshotQuality`
- eval: `expression` (JS)
- scroll: `direction: Literal['down','up','left','right']`, `amount`
- batch: `commands` (JSON array)

Browser config: `browser: Literal['chrome','edge','chromium','bundled_explicit','custom']`, conditional `executablePath` (custom), `newWindow`, `chromeProfile`, `headed`, `autoConnect`, `actionDelay`, `userAgent`, `proxy`, `session`, `timeout`.

</details>

---

## Crawlee (1)

### `crawleeScraper` (22 fields, dual-purpose)

**Source:** `crawleeNodes.ts:11-252` · Group: `['api', 'tool']`

**Properties** (22): `toolName`/`toolDescription`, `crawlerType: Literal['beautifulsoup','playwright','adaptive']`, `url`, `mode: Literal['single','crawl']`, `cssSelector`, `extractLinks`, cascaded crawl-mode fields (linkSelector/urlPattern/maxPages/maxDepth), Playwright-conditional fields (waitForSelector/waitTimeout/screenshot/browserType/blockResources), `timeout`, `maxConcurrency`, `outputFormat: Literal['text','html','markdown']`, proxy params.

---

## Apify (1)

### `apifyActor` (21 fields, dual-purpose)

**Source:** `apifyNodes.ts:17-246` · Group: `['api', 'scraper', 'tool']`

**Properties** (21): `actorId` (11 presets + custom), `customActorId` (conditional), `actorInput` (JSON), actor-specific cascaded fields (Instagram URLs, TikTok profiles/hashtags, Twitter queries/handles, Google search, crawler start URLs/depth/pages), `maxResults`, `timeout`, `memory: Literal[128,256,512,1024,2048,4096]` MB.

---

## Proxy (3)

### `proxyRequest` (15 fields, dual-purpose)

**Source:** `proxyNodes.ts:12-127`

**Properties** (15): `method` (GET/POST/PUT/DELETE/PATCH), `url`, `headers`, conditional `body` (POST/PUT/PATCH), `timeout`, `proxyProvider`, `proxyCountry`, `sessionType: Literal['rotating','sticky']`, conditional `stickyDuration`, `maxRetries`, `followRedirects`.

---

### `proxyConfig` (19 fields, dual-purpose)

**Source:** `proxyNodes.ts:129-292`

**Properties** (19): `operation` (10 ops: list_providers / add_provider / update_provider / remove_provider / set_credentials / test_provider / get_stats / add_routing_rule / list_routing_rules / remove_routing_rule), cascaded fields per operation.

---

### `proxyStatus`

**Source:** `proxyNodes.ts:294-320`

**Properties** (1): `providerFilter: str` (optional).

---

## Utility (6)

### `httpRequest` (10 fields, dual-purpose)

**Source:** `utilityNodes.ts:8-105`

**Properties** (10): `method`, `url`, `headers`, conditional `body`, `timeout`, `useProxy` + conditional proxy params (country/provider/sessionType).

---

### `webhookTrigger`

**Source:** `utilityNodes.ts:107-180` · **Visual:** TriggerNode

**Properties** (8): `path`, `method: Literal['GET','POST','PUT','DELETE','ALL']`, `responseMode: Literal['immediate','responseNode']`, `authentication: Literal['none','header']`, conditional `headerName`/`headerValue`.

---

### `webhookResponse`

**Source:** `utilityNodes.ts:182-219`

**Properties** (3): `statusCode`, `responseBody`, `contentType: Literal['application/json','text/plain','text/html']`.

---

### `chatTrigger`

**Source:** `utilityNodes.ts:221-252` · **Visual:** TriggerNode

**Properties** (2): `sessionId` (default `default`), `placeholder` (default `'Type a message...'`).

---

### `console`

**Source:** `utilityNodes.ts:254-317`

**Properties** (6): `label`, `logMode: Literal['all','field','expression']`, conditional `fieldPath` / `expression`, `format: Literal['json','json_compact','text','table']`.
**Note:** Input passes through unchanged — logging side-effect only.

---

### `teamMonitor`

**Source:** `utilityNodes.ts:319-362` · Group: `['utility', 'agent']`
**Middle-section:** standard, BUT ParameterPanel hides Input/Output sections (`isMonitorNode` check). Renders an embedded dashboard.

**Properties** (4): `refreshInterval: int 100-10000 (default 1000)`, `showTaskHistory`, `showMessages`, `maxHistoryItems: int 10-200 (default 50)`.
**Expected uiHints:** `{isMonitorPanel: true, hideInputSection: true, hideOutputSection: true}`.

---

## Document Pipeline (6)

### `httpScraper`

**Source:** `documentNodes.ts:8-122` · Group: `['document']`

**Properties** (12): `url` (with `{date}`/`{page}` placeholders), `iterationMode: Literal['single','date','page']`, cascaded date range or page range, `linkSelector`, `headers`, proxy params.

---

### `fileDownloader`

**Source:** `documentNodes.ts:124-170`

**Properties** (4): `outputDir` (default `./data/downloads`), `maxWorkers: int 1-32 (default 8)`, `skipExisting`, `timeout: int 10-600`.

---

### `documentParser`

**Source:** `documentNodes.ts:172-215`

**Properties** (4): `parser: Literal['pypdf','marker','unstructured','beautifulsoup']`, `inputDir`, `filePattern` (glob).

---

### `textChunker`

**Source:** `documentNodes.ts:217-261`

**Properties** (4): `chunkSize: int 100-8000 (default 1024)`, `chunkOverlap: int 0-1000 (default 200)`, `strategy: Literal['recursive','markdown','token']`.

---

### `embeddingGenerator`

**Source:** `documentNodes.ts:263-314`

**Properties** (5): `provider: Literal['huggingface','openai','ollama']`, `model: str (default 'BAAI/bge-small-en-v1.5')`, `batchSize: int 1-256`, conditional `apiKey` (password, OpenAI only).

---

### `vectorStore`

**Source:** `documentNodes.ts:316-394`

**Properties** (9): `operation: Literal['store','query','delete']`, `backend: Literal['chroma','qdrant','pinecone']`, `collectionName`, conditional `persistDir` (chroma) / `qdrantUrl` (qdrant) / `pineconeApiKey` (pinecone, password), `topK: int 1-100 (default 5)` (query only).

---

## Android Services (16)

All 16 instantiated via `createAndroidServiceNode()` factory (`androidServiceNodes.ts:13-144`). Shared structure first, then per-node differences.

### Shared Structure (all 16)

- **Visual:** SquareNode
- **Dual-purpose:** yes — can connect to agent `input-tools` (dual output `tool` + `main`)
- **Middle-section:** standard

**Shared properties** (5):

| name | type | default | notes |
|---|---|---|---|
| service_id | hidden | (per-node) | Auto-set; identifies backend service |
| android_host | hidden | `localhost` | TCP bridge host |
| android_port | hidden | `8888` | TCP bridge port |
| label | string | (displayName) | User-customizable instance label |
| action | options | (per-node) | `loadOptionsMethod: 'getAndroidServiceActions'` — fetches available actions from backend |

**Plus the action-specific `parameters: Dict[str, Any]` dispatched via the Android service.**

### Per-node table

| Node | service_id | Icon | Color | Group | Default action | Extra fields |
|---|---|---|---|---|---|---|
| `batteryMonitor` | `battery` | 🔋 | green | monitoring | status | — |
| `networkMonitor` | `network` | 📡 | blue | monitoring | status | — |
| `systemInfo` | `system_info` | 📱 | purple | monitoring | info | — |
| `location` | `location` | 📍 | red | monitoring | current | — |
| `appLauncher` | `app_launcher` | 🚀 | orange | apps | launch | `package_name` (required when action=launch) |
| `appList` | `app_list` | 📋 | cyan | apps | list | — |
| `wifiAutomation` | `wifi_automation` | 📶 | indigo | automation | status | — |
| `bluetoothAutomation` | `bluetooth_automation` | 🔵 | blue | automation | status | — |
| `audioAutomation` | `audio_automation` | 🔊 | pink | automation | get_volume | — |
| `deviceStateAutomation` | `device_state_automation` | ⚙️ | blue-grey | automation | status | — |
| `screenControlAutomation` | `screen_control_automation` | 💡 | amber | automation | status | — |
| `airplaneModeControl` | `airplane_mode_control` | ✈️ | brown | automation | status | — |
| `motionDetection` | `motion_detection` | 📳 | deep orange | sensors | current_motion | — |
| `environmentalSensors` | `environmental_sensors` | 🌡️ | teal | sensors | ambient_conditions | — |
| `cameraControl` | `camera_control` | 📷 | deep purple | media | camera_info | — |
| `mediaControl` | `media_control` | 🎵 | pink | media | volume_control | — |

**Expected Pydantic patterns:** Each service's Python side has `action: Literal[...]` (service-specific action list) and `parameters: Dict[str, Any]`. Frontend receives the action list via the backend `loadOptionsMethod`.

---

## Appendix A — Specialized-selector dispatch rules

Located in `ParameterRenderer.tsx` (~lines 1534-1590). Selector components are picked based on `parameter.name`, not on `type`:

| Parameter name | Dispatched component | Loads | Used by |
|---|---|---|---|
| `group_id` | `GroupIdSelector` | WhatsApp groups via `getWhatsAppGroups()` WebSocket handler; filters communities; drag-drop enabled | `whatsappSend`, `whatsappReceive`, `whatsappDb` |
| `channel_jid` | `ChannelJidSelector` | WhatsApp newsletter channels via `getWhatsAppChannels()`; subscriber count + role | `whatsappSend`, `whatsappReceive`, `whatsappDb` |
| `senderNumber` | `SenderNumberSelector` | Group members via `getWhatsAppGroupInfo(group_id)`; depends on selected `group_id`; "All Members" default | `whatsappReceive` |

**Persistence pattern:** each selector stores both the ID and a parallel display-name parameter (`group_id` + `group_name`, `phone_number` + `sender_name`) so the UI shows readable names without refetching on panel reopen.

---

## Appendix B — MiddleSection branching table

Every node that triggers a specialized editor, and the exact baseline condition:

| Branch | Baseline condition | Nodes affected | Target uiHint |
|---|---|---|---|
| `masterSkillEditor` | `name === 'masterSkill'` | `masterSkill` | `isMasterSkillEditor: true` |
| `memoryPanel` | `name === 'simpleMemory'` | `simpleMemory` | `isMemoryPanel: true` |
| `codeEditorLayout` | `name === 'pythonExecutor' \|\| 'javascriptExecutor'` **(bug: missing `typescriptExecutor`)** | `pythonExecutor`, `javascriptExecutor`, (should include `typescriptExecutor`) | `hasCodeEditor: true` |
| `toolSchemaEditor` | `name ∈ TOOL_NODE_TYPES = ['androidTool','calculatorTool','currentTimeTool','duckduckgoSearch']` **(bug: missing `taskManager`, `writeTodos`)** | 4 nodes in baseline; post-migration: all 5 tools + `androidTool` | `isToolPanel: true` |
| `agentWithSkills` | `name ∈ AGENT_WITH_SKILLS_TYPES` (all 18 agents: `aiAgent`, `chatAgent`, 13 specialized, 3 team leads) | All 18 agents | `hasSkills: true` |
| `locationPanel` | `name === 'gmaps_create'` (Dashboard.tsx routes to `LocationParameterPanel`, not `ParameterPanel`) | `gmaps_create` | `showLocationPanel: true` |
| `monitorPanel` | `name === 'teamMonitor'` (ParameterPanel hides Input/Output sections) | `teamMonitor` | `isMonitorPanel: true, hideInputSection: true, hideOutputSection: true` |
| `standard` | default fallthrough | Everything else (~80 nodes) | `{}` (no special hint) |

---

## Appendix C — Post-migration checklist

Per-node: what the plugin class must declare to reproduce baseline UI. Use this list to verify the feature-branch plugin classes after the dead-code pass.

### Required `usable_as_tool = True` (dual-purpose nodes — 36 total)

Every node in these groups: `['x', 'tool']`:
- All 9 AI chat models → no (they're `['model']`)
- `simpleMemory` → `['tool', 'memory']`
- All 5 tool nodes (calculator, currentTime, duckduckgo, taskManager, writeTodos)
- All 3 search nodes (brave, serper, perplexity)
- All 3 code executors (python, javascript, typescript)
- All 4 filesystem (fileRead, fileModify, shell, fsSearch)
- `processManager`
- WhatsApp send + db; Telegram send; Twitter send/search/user; social send; email send + read
- `gmaps_locations`, `gmaps_nearby_places`
- `browser`, `crawleeScraper`, `apifyActor`
- All 3 proxy (request, config, status)
- `httpRequest`, `timer`, `cronScheduler`
- All 16 Android services
- `masterSkill` (but see below)

### Required uiHints by branch

| uiHint | Plugins that must declare it |
|---|---|
| `hasSkills: True` | All 18 agent plugins (via shared `STD_AGENT_HINTS` mixin) |
| `isMasterSkillEditor: True` + `isToolPanel: True` + `hideRunButton: True` | `masterSkill` |
| `isMemoryPanel: True` + `hasCodeEditor: True` + `hideRunButton: True` | `simpleMemory` |
| `hasCodeEditor: True` | All 3 code executors (via `code/_base.py`) |
| `isToolPanel: True` + `hideRunButton: True` | All 5 tool nodes + 3 search nodes + `androidTool` (if preserved) |
| `showLocationPanel: True` | `gmaps_create` |
| `isMonitorPanel: True` + `hideInputSection: True` + `hideOutputSection: True` | `teamMonitor` |

### Required Pydantic `Params` with `Literal` operation selectors (operation-heavy nodes)

These nodes have 5+ operations with cascading `displayOptions.show` — the Pydantic `Params` class must preserve these as `Literal[...]` + `json_schema_extra={"displayOptions": {...}}` on each conditional field:

- Google: `gmail` (3), `calendar` (4), `drive` (4), `sheets` (3), `tasks` (5), `contacts` (6)
- `whatsappDb` (18 operations — the biggest)
- `browser` (14 operations)
- `proxyConfig` (10 operations)
- `processManager` (6 operations)
- `vectorStore` (3), `textChunker` (3), `embeddingGenerator` (3 providers with conditional apiKey)
- `fsSearch` (3 modes), `fileModify` (2 operations), `emailRead` (7 operations)
- `twitterSend` (7 actions), `twitterUser` (5 operations), `twitterReceive` (3 trigger types)
- `cronScheduler` (7 frequencies)
- `crawleeScraper` (3 crawler types + 2 modes)
- `apifyActor` (11 actor presets)

### Specialized-selector preservation

Plugin `ui_hints` should expose selector component hints so the frontend keeps using the WhatsApp-specific selectors:

- `whatsappSend`: declare `group_id` and `channel_jid` fields with `json_schema_extra={"component": "GroupIdSelector"}` / `"ChannelJidSelector"`
- `whatsappReceive`: additionally `senderNumber` with `"SenderNumberSelector"` and `"dependsOn": "group_id"`
- `whatsappDb`: both GroupIdSelector and ChannelJidSelector fields

### Known baseline bugs the plugin migration can fix (no regression)

1. `typescriptExecutor` never got code-editor layout on baseline (`isCodeExecutorNode` hardcoded to python/javascript). Plugin inheriting `hasCodeEditor: true` from `code/_base.py` fixes this.
2. `taskManager` and `writeTodos` never rendered `ToolSchemaEditor` on baseline (not in `TOOL_NODE_TYPES`). Declaring `isToolPanel: true` on their plugin classes fixes this.
3. Paid-search asymmetry: `duckduckgoSearch` was in `TOOL_NODE_TYPES` but `braveSearch`/`serperSearch`/`perplexitySearch` were not. Harmonizing via `isToolPanel: true` on all 4 is defensible (not a regression either way).

### Android service note

The `androidTool` backend dispatcher (`server/services/plugin/edge_walker.py` + `execute_android_toolkit`) exists on target for legacy aggregator support, but no frontend-registered `androidTool` node exists in target plugins. If the feature branch still exposes `androidTool` in the palette, add a plugin class; otherwise remove from the frontend definitions.

---

## Doc generated

From `main` branch on 2026-04-24. 109 nodes documented. Sources cross-referenced against `MiddleSection.tsx`, `ParameterRenderer.tsx`, `Dashboard.tsx`, and all 26 `nodeDefinitions/*.ts` files. For questions or gaps, open an issue or ping the session that produced this reference.
