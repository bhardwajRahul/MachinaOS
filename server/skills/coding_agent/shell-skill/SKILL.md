---
name: shell-skill
description: Execute shell commands and return stdout, stderr, and exit code.
allowed-tools: shell_execute
metadata:
  author: machina
  version: "1.0"
  category: execution
  icon: "\U0001F4BB"
  color: "#ff79c6"
---

# Shell Tool

Execute shell commands with timeout control. Uses deepagents LocalShellBackend.

## shell_execute Tool

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| command | string | Yes | Shell command to execute |
| timeout | int | No | Timeout in seconds (default: 30, max: 300) |

### Examples

**List files:**
```json
{"command": "ls -la /path/to/dir"}
```

**Run a script:**
```json
{"command": "python script.py --arg value", "timeout": 60}
```

**Check disk usage:**
```json
{"command": "df -h"}
```

**Install a package:**
```json
{"command": "pip install requests", "timeout": 120}
```

### Response Format

```json
{
  "stdout": "command output here",
  "exit_code": 0,
  "truncated": false,
  "command": "ls -la"
}
```

### Guidelines

1. Set appropriate timeouts for long-running commands
2. Exit code 0 means success, non-zero means failure
3. Exit code 124 means the command timed out
4. Check `truncated` flag -- output may be cut if too large
5. Use absolute paths when possible
6. Chain commands with `&&` for sequential execution
7. Avoid interactive commands that require user input
8. **Do NOT start background servers or daemons** (e.g. `python -m http.server`, `npm start`, `start /B`). The shell waits for the process to exit -- daemons will hang until timeout. Use short-lived commands only.
