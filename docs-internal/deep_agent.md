# Deep Agent: LangChain DeepAgents Integration

Specialized agent node powered by [LangChain DeepAgents](https://github.com/langchain-ai/deepagents) -- a batteries-included agent harness with built-in filesystem tools, sub-agent delegation, auto-summarization, and todo planning.

> **Related Documentation:**
> - [Agent Architecture](./agent_architecture.md) - LangGraph skill injection and tool execution
> - [Specialized Agent Guide](./specialized_agent_node_creation.md) - Creating specialized AI agents
> - [Agent Delegation](./agent_delegation.md) - Memory, parameters, and execution context flow

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [DeepAgents Package](#deepagents-package)
4. [MachinaOs Integration](#machinaos-integration)
5. [Node Definition](#node-definition)
6. [Key Files](#key-files)
7. [Comparison with Other Agent Types](#comparison-with-other-agent-types)

---

## Overview

Deep Agent combines MachinaOs's existing agent infrastructure (skill injection, tool building, model resolution, memory) with the LangChain `deepagents` package, which provides a pre-configured middleware stack inspired by Claude Code.

**What deepagents adds over standard LangGraph agents:**
- Built-in filesystem tools (read, write, edit, ls, glob, grep, execute)
- Todo-based planning via `write_todos` tool
- Sub-agent delegation via `task` tool
- Auto-summarization when conversations grow long
- Prompt caching middleware (Anthropic models)

**What MachinaOs provides:**
- Provider/model selection from `llm_defaults.json` (9 providers)
- Tool node connections (calculator, search, WhatsApp, Android, etc.)
- Skill injection from Master Skill / SKILL.md files
- Memory via Simple Memory node
- Teammate delegation via `input-teammates` handle
- Real-time status broadcasting via WebSocket

---

## Architecture

```
User clicks "Run" on Deep Agent
        |
        v
useExecution.executeNode()                client/src/hooks/useExecution.ts
        |
        v
WebSocket: handle_execute_node()          server/routers/websocket.py
        |
        v
NodeExecutor._dispatch()                  server/services/node_executor.py
  Registry: 'deep_agent' -> handle_chat_agent (via partial)
        |
        v
handle_chat_agent()                       server/services/handlers/ai.py
  1. _collect_agent_connections()
     - input-memory  -> memory_data
     - input-skill   -> skill_data[]
     - input-tools   -> tool_data[]
     - input-main    -> input_data
     - input-task    -> task_data
  2. deep_agent in TEAM_LEAD_TYPES
     -> _collect_teammate_connections()
     -> teammates added as delegation tool_data
  3. Delegates to execute_chat_agent(node_type='deep_agent')
        |
        v
AIService.execute_chat_agent()            server/services/ai.py
  Shared setup (same as chatAgent/all specialized agents):
  - _build_skill_system_prompt() -> system_message
  - _build_tool_from_node() for each tool_data entry -> all_tools[]
  - Model validation via is_model_valid_for_provider()
  - API key resolution
  - Temperature, max_tokens resolution from model registry
        |
        v
  Branch: node_type == 'deep_agent'
        |
        v
deepagents.create_deep_agent()            deepagents package
  model = "{provider}:{model}"
  tools = all_tools (MachinaOs connected tools)
  system_prompt = system_message (includes skills)
  + built-in: read_file, write_file, edit_file, ls, glob,
              grep, execute, write_todos, task
        |
        v
agent.ainvoke(messages, config)
  Middleware stack processes request:
  TodoList -> Skills -> Filesystem -> SubAgent
  -> Summarization -> ToolCallPatching -> PromptCaching
        |
        v
Extract final AI message -> return result
```

---

## DeepAgents Package

### Installation

```
pip install deepagents>=0.4.12
```

**Dependencies:** `langchain-core`, `langchain`, `langchain-anthropic`, `langchain-google-genai`, `wcmatch`

### create_deep_agent()

```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model=None,             # str ("provider:model") | BaseChatModel | None
    tools=None,             # Sequence[BaseTool | Callable | dict]
    system_prompt=None,     # str | SystemMessage
    middleware=(),           # Sequence[AgentMiddleware]
    subagents=None,         # Sequence[SubAgent | CompiledSubAgent | AsyncSubAgent]
    skills=None,            # list[str] (paths to skill dirs)
    memory=None,            # list[str] (paths to AGENTS.md files)
    response_format=None,   # ResponseFormat | type | dict
    backend=None,           # BackendProtocol | BackendFactory
    interrupt_on=None,      # dict[str, bool | InterruptOnConfig]
    debug=False,            # bool
    name=None,              # str
)
```

Returns a **`CompiledStateGraph`** -- a compiled LangGraph graph compatible with streaming, Studio, checkpointers, and all LangGraph features.

**Default model:** `claude-sonnet-4-6` (via `ChatAnthropic`).

### Built-in Tools

| Tool | Middleware | Description |
|------|-----------|-------------|
| `write_todos` | TodoListMiddleware | Task breakdown and progress tracking |
| `read_file` | FilesystemMiddleware | Read file contents with offset/limit |
| `write_file` | FilesystemMiddleware | Write/create files |
| `edit_file` | FilesystemMiddleware | Edit files with string replacement |
| `ls` | FilesystemMiddleware | List directory contents |
| `glob` | FilesystemMiddleware | Glob pattern file matching |
| `grep` | FilesystemMiddleware | Search file contents with regex |
| `execute` | FilesystemMiddleware | Run shell commands (requires SandboxBackendProtocol) |
| `task` | SubAgentMiddleware | Delegate work to sub-agents with isolated context |

### Middleware Stack (default order)

1. **TodoListMiddleware** -- Planning tool (`write_todos`)
2. **SkillsMiddleware** (conditional) -- Load skills from file paths
3. **FilesystemMiddleware** -- File operations + shell execution
4. **SubAgentMiddleware** -- Sub-agent spawning via `task` tool
5. **SummarizationMiddleware** -- Auto-summarization when conversations grow long
6. **PatchToolCallsMiddleware** -- Tool call patching
7. **AnthropicPromptCachingMiddleware** -- Prompt caching (Anthropic models only)
8. **MemoryMiddleware** (conditional) -- Persistent memory from AGENTS.md files

Custom tools passed via `tools=` parameter are added alongside (not replacing) the built-in tools.

### Backends

Backends control where filesystem tools operate:

| Backend | Description |
|---------|-------------|
| `StateBackend` | Default. Files stored in LangGraph state (in-memory, ephemeral) |
| `FilesystemBackend` | Direct local filesystem access |
| `LocalShellBackend` | Filesystem + unrestricted shell execution |
| `StoreBackend` | Persistent storage via LangGraph BaseStore |
| `LangSmithSandbox` | Remote sandboxed execution |
| `CompositeBackend` | Route paths to different backends |

The `execute` tool requires a `SandboxBackendProtocol` backend (e.g., `LocalShellBackend`). Without it, `execute` returns an error message.

### Sub-Agent Types

| Type | Description |
|------|-------------|
| `SubAgent` | Declarative spec: name, description, system_prompt, optional tools/model |
| `CompiledSubAgent` | Pre-built runnable (any LangGraph/LangChain Runnable) |
| `AsyncSubAgent` | Remote/background agent via graph_id + url |

### Model Resolution

Format: `"provider:model"` -- e.g., `"openai:gpt-5.4"`, `"google_genai:gemini-2.5-flash"`, `"anthropic:claude-sonnet-4-6"`, `"openrouter:anthropic/claude-sonnet-4.6"`.

Default: `claude-sonnet-4-6` via `ChatAnthropic`.

---

## MachinaOs Integration

### Execution Path

Deep Agent reuses the **entire** `handle_chat_agent` pipeline. No separate handler or service file exists. The only new code is a branch inside `execute_chat_agent` at the graph creation point:

```python
# server/services/ai.py - inside execute_chat_agent()
# After all shared setup: skill injection, tool building, model resolution...

if node_type == 'deep_agent':
    from deepagents import create_deep_agent

    _da_prefix = {"gemini": "google_genai"}
    model_id = f"{_da_prefix.get(provider, provider)}:{model}"
    max_turns = int(parameters.get('maxTurns', 25))

    agent = create_deep_agent(
        model=model_id,
        tools=all_tools if all_tools else None,
        system_prompt=system_message,
    )

    da_result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": prompt}]},
        config={"recursion_limit": max_turns * 2},
    )
    # ... extract response from last AI message
```

### What is Reused (from execute_chat_agent)

| Step | Function | Description |
|------|----------|-------------|
| Skill injection | `_build_skill_system_prompt()` | SKILL.md instructions merged into system_message |
| Tool building | `_build_tool_from_node()` | Connected tool nodes -> LangChain StructuredTool |
| Model validation | `is_model_valid_for_provider()` | Validates model against provider's model list |
| Default model | `get_default_model_async()` | Falls back to llm_defaults.json default |
| API key | `self.auth.get_api_key()` | Fetches from encrypted credentials |
| Max tokens | `_resolve_max_tokens()` | Resolves from model registry + llm_defaults |
| Temperature | `_resolve_temperature()` | Clamped to provider range, thinking-aware |
| Status broadcast | `broadcast_status()` | Real-time UI updates via WebSocket |
| Token logging | `log_execution_time()`, `log_api_call()` | Metrics tracking |

### Provider Mapping

MachinaOs providers map to deepagents model prefixes:

| MachinaOs Provider | deepagents Prefix | Example |
|-------------------|-------------------|---------|
| `openai` | `openai` | `openai:gpt-5.4` |
| `anthropic` | `anthropic` | `anthropic:claude-sonnet-4-6` |
| `gemini` | `google_genai` | `google_genai:gemini-2.5-flash` |
| `openrouter` | `openrouter` | `openrouter:anthropic/claude-sonnet-4.6` |
| `groq` | `groq` | `groq:llama-4-scout` |
| `cerebras` | `cerebras` | `cerebras:llama3.1-8b` |
| `deepseek` | `deepseek` | `deepseek:deepseek-chat` |
| `kimi` | `kimi` | `kimi:kimi-k2.5` |
| `mistral` | `mistral` | `mistral:mistral-large-latest` |

Only `gemini` differs (`google_genai`). All others use the MachinaOs provider name directly.

### Team Mode (Teammate Delegation)

`deep_agent` is in `TEAM_LEAD_TYPES` alongside `orchestrator_agent` and `ai_employee`. Agents connected to the `input-teammates` handle become delegation tools in `tool_data`, which are then built as `delegate_to_*` StructuredTools and passed to `create_deep_agent(tools=...)`.

---

## Node Definition

### Properties

Inherits all `AI_AGENT_PROPERTIES` via spread:
- **AI Provider** (options: openai, anthropic, gemini, openrouter)
- **Model** (dynamic options based on provider)
- **Prompt** (string, multiline)
- **System Message** (string, multiline)
- **Options** (collection: temperature, maxTokens, thinkingEnabled, thinkingBudget, reasoningEffort)

Plus one additional property:
- **Max Turns** (number, default: 25, range: 1-100) -- Maximum agentic loop iterations

### Input Handles

| Handle | Position | Description |
|--------|----------|-------------|
| `input-main` | Left 30% | Primary input (auto-prompt fallback) |
| `input-memory` | Left 65% | Simple Memory node for conversation history |
| `input-task` | Left 85% | Task completion events from taskTrigger |
| `input-skill` | Bottom 20% | Skill nodes (Master Skill) |
| `input-teammates` | Bottom 50% | Agents for sub-agent delegation |
| `input-tools` | Bottom 80% | Tool nodes for LLM tool calling |

### Output Handle

| Handle | Position | Description |
|--------|----------|-------------|
| `output-top` | Top | Agent output |

### Visual Config

- **Icon:** Brain (U+1F9E0)
- **Theme color:** `dracula.green`
- **Dimensions:** 300x200px
- **Component:** `AIAgentNode` (shared with all specialized agents)

---

## Key Files

| File | What Changed |
|------|-------------|
| `client/src/nodeDefinitions/specializedAgentNodes.ts` | Node definition + `SPECIALIZED_AGENT_TYPES` |
| `client/src/components/AIAgentNode.tsx` | `AGENT_CONFIGS` visual entry |
| `client/src/components/parameterPanel/MiddleSection.tsx` | `AGENT_WITH_SKILLS_TYPES` |
| `client/src/components/parameterPanel/InputSection.tsx` | `AGENT_WITH_SKILLS_TYPES` + `aiAgentTypes` |
| `client/src/contexts/WebSocketContext.tsx` | `LONG_RUNNING_NODE_TYPES` |
| `server/constants.py` | `AI_AGENT_TYPES` |
| `server/services/node_executor.py` | Handler registry -> `handle_chat_agent` |
| `server/services/handlers/ai.py` | `TEAM_LEAD_TYPES`, passes `node_type` to service |
| `server/services/ai.py` | `execute_chat_agent` branch + delegation tool name |
| `server/services/handlers/tools.py` | Delegation tuple |
| `server/requirements.txt` | `deepagents>=0.4.12` |
| `server/pyproject.toml` | `deepagents>=0.4.12` |

---

## Comparison with Other Agent Types

| Aspect | chatAgent | deep_agent | claude_code_agent |
|--------|-----------|------------|-------------------|
| **Handler** | `handle_chat_agent` | `handle_chat_agent` | `handle_claude_code_agent` |
| **Graph creation** | Manual LangGraph `build_agent_graph()` | `deepagents.create_deep_agent()` | Claude Code CLI subprocess |
| **Built-in tools** | None (only connected tools) | 9 (filesystem, todos, task, execute) | 6 (Read, Edit, Bash, Glob, Grep, Write) |
| **Connected tools** | Yes (via `input-tools`) | Yes (passed to `create_deep_agent(tools=)`) | No |
| **Skills** | Yes | Yes | Yes (system prompt only) |
| **Memory** | Yes (markdown + vector) | No (deepagents manages its own) | No |
| **Teammates** | Only for team leads | Yes (TEAM_LEAD_TYPES) | No |
| **Properties** | `AI_AGENT_PROPERTIES` | `AI_AGENT_PROPERTIES` + maxTurns | Custom (prompt, model, allowedTools, etc.) |
| **Providers** | All 9 | All 9 | Anthropic only |
| **Middleware** | None | 8-layer stack (auto-summarization, caching, etc.) | None |
| **Auto-summarization** | No | Yes (SummarizationMiddleware) | No |
| **Planning** | No | Yes (`write_todos` tool) | No |
