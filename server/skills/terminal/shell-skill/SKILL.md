---
name: shell-skill
description: Execute short-lived shell commands in a sandboxed environment. No PATH access -- use process_manager for npm/python/node commands.
allowed-tools: shell_execute
metadata:
  author: machina
  version: "2.0"
  category: execution
  icon: "\U0001F4BB"
  color: "#ff79c6"
---

# Shell Tool

Execute short-lived shell commands in a sandboxed workspace. The shell runs with a **restricted environment** (no system PATH). For commands that need `npm`, `python`, `node`, or other system tools, use the **process_manager** tool instead.

## shell_execute Tool

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| command | string | Yes | Shell command to execute |
| timeout | int | No | Timeout in seconds (default: 30, max: 300) |

### Examples

```json
{"command": "ls -la"}
{"command": "cat README.md"}
{"command": "echo hello > output.txt"}
{"command": "find . -name '*.py' -type f"}
```

### Response

```json
{
  "stdout": "command output",
  "exit_code": 0,
  "truncated": false,
  "command": "ls -la"
}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 124 | Timed out |
| non-zero | Failure |

## Shell vs Process Manager

| Need | Tool | Why |
|------|------|-----|
| List files, read files, move/copy | **shell_execute** | Sandboxed, safe |
| Delete files (`rm`, `del`) | **shell_execute** | Confined to workspace |
| Search content (grep, find) | **shell_execute** | Fast, no PATH needed |
| Echo, cat, simple file ops | **shell_execute** | Sandboxed |
| `npm install`, `pip install` | **process_manager** | Needs PATH |
| `python script.py`, `node app.js` | **process_manager** | Needs PATH |
| Dev servers, watchers, build tools | **process_manager** | Long-running |

The shell is the **only safe tool for file deletion**. It runs inside the agent's workspace with `virtual_mode=True` (path traversal blocked). The process_manager blocks destructive commands like `rm` since it has full PATH and could reach outside the workspace.

## OS-Specific Commands

For OS-specific syntax and tools, refer to:
- **bash-skill** -- Linux/macOS commands (find, grep, apt, brew)
- **powershell-skill** -- Windows commands (Get-ChildItem, Select-String)
- **wsl-skill** -- Running Linux tools on Windows via WSL

These skills are in the `terminal` skill folder alongside this one.

## Guidelines

1. **Short-lived commands only** -- the shell waits for completion
2. **No system PATH** -- `npm`, `python`, `node` will not be found. Use process_manager
3. **No daemons/servers** -- commands that don't exit will hang until timeout
4. Exit code 124 = timed out
5. Check `truncated` flag for large output
6. Use relative paths (workspace is the working directory)
7. Chain with `&&` for sequential execution
8. Avoid interactive commands requiring user input
