---
name: shell-skill
description: Execute short-lived shell commands in a sandboxed environment. No PATH access -- use process_manager for npm/python/node commands.
allowed-tools: shell_execute
metadata:
  author: machina
  version: "3.0"
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

### Response

```json
{
  "stdout": "command output",
  "exit_code": 0,
  "truncated": false,
  "command": "dir"
}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 124 | Timed out |
| non-zero | Failure |

## OS-Specific Commands

The shell uses the system's native shell (`cmd.exe` on Windows, `/bin/sh` on Linux/macOS). Use the correct commands for the platform.

### Detect OS first

```json
{"command": "ver"}
```
If output contains `Windows`, use Windows commands. Otherwise use Unix commands.

### Windows (cmd.exe)

| Task | Command |
|------|---------|
| List files | `dir` |
| List with details | `dir /a` |
| Read file | `type README.md` |
| Write to file | `echo hello > output.txt` |
| Find files | `dir /s /b *.py` |
| Search content | `findstr /s /i "pattern" *.py` |
| Copy file | `copy src.txt dst.txt` |
| Move file | `move src.txt dst.txt` |
| Delete file | `del output.txt` |
| Delete folder | `rmdir /s /q folder` |
| Create folder | `mkdir newfolder` |
| Show current dir | `cd` |

### Linux / macOS (sh)

| Task | Command |
|------|---------|
| List files | `ls -la` |
| Read file | `cat README.md` |
| Write to file | `echo hello > output.txt` |
| Find files | `find . -name '*.py' -type f` |
| Search content | `grep -r "pattern" --include='*.py' .` |
| Copy file | `cp src.txt dst.txt` |
| Move file | `mv src.txt dst.txt` |
| Delete file | `rm output.txt` |
| Delete folder | `rm -rf folder` |
| Create folder | `mkdir -p newfolder` |
| Show current dir | `pwd` |

## Shell vs Process Manager

| Need | Tool | Why |
|------|------|-----|
| List/read/copy/move files | **shell_execute** | Sandboxed, safe |
| Delete files | **shell_execute** | Confined to workspace |
| Search file content | **shell_execute** | Fast, no PATH needed |
| `npm install`, `pip install` | **process_manager** | Needs PATH |
| `python script.py`, `node app.js` | **process_manager** | Needs PATH |
| Dev servers, watchers | **process_manager** | Long-running |

The shell is the **only safe tool for file deletion**. It runs inside the agent's workspace with `virtual_mode=True` (path traversal blocked). The process_manager blocks destructive commands since it has full PATH.

## Guidelines

1. **Detect OS first** -- use `ver` to check Windows vs Unix, then use correct commands
2. **Short-lived commands only** -- the shell waits for completion
3. **No system PATH** -- `npm`, `python`, `node` will not be found. Use process_manager
4. **No daemons/servers** -- commands that don't exit will hang until timeout
5. Use relative paths (workspace is the working directory)
6. Chain with `&&` for sequential execution
7. Avoid interactive commands requiring user input
