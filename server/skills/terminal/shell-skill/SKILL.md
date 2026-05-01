---
name: shell-skill
description: Execute short-lived shell commands inside the per-workflow workspace. The shell is Nushell (cross-platform, same syntax on Windows/macOS/Linux). External tools on PATH (npm, node, python, git, ...) are available.
allowed-tools: "shell"
metadata:
  author: machina
  version: "4.0"
  category: execution

---

# Shell Tool (Nushell)

Execute short-lived shell commands in the workflow workspace. **The shell is [Nushell](https://www.nushell.sh/) — the same grammar runs on Windows, macOS, and Linux.** Do not write `cmd.exe`, PowerShell, or Bash idioms; they will fail or behave wrong.

External binaries on `PATH` (`npm`, `node`, `python`, `git`, `pwd`, etc.) are available — Nu invokes them as external commands automatically.

## shell_execute Tool

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| command | string | Yes | Nushell command (single or `;`-chained) |
| timeout | int | No | Seconds (default 30, max 300) |

### Response

```json
{
  "stdout": "command output",
  "exit_code": 0,
  "truncated": false,
  "command": "ls"
}
```

| Exit code | Meaning |
|---|---|
| 0 | Success |
| 124 | Timed out |
| non-zero | Failure |

## Critical: Nushell ≠ Bash

| Bash / cmd.exe (do NOT use) | Nushell (correct) |
|---|---|
| `cmd1 && cmd2` (and-then) | `cmd1; cmd2` *(unconditional sequential — see below for short-circuit)* |
| `cmd1 || cmd2` (or-else) | `try { cmd1 } catch { cmd2 }` |
| `$VAR` substitution | `$env.VAR` |
| `` `cmd` `` or `$(cmd)` | `(cmd)` *(parens, no dollar)* |
| `cmd > file.txt` | `cmd \| save file.txt` |
| `cmd >> file.txt` | `cmd \| save --append file.txt` |
| `cmd 2>&1` | `cmd \| complete \| get stdout` *(all output is captured anyway)* |
| `if [ -f x.txt ]; then ...` | `if ('x.txt' \| path exists) { ... }` |
| `for f in *.py; do ...` | `glob '*.py' \| each { \|f\| ... }` |
| `*` glob in argv (auto-expand) | wrap in quotes or use `glob` |
| `~/path` | `('~/path' \| path expand)` |

### Short-circuit "and-then" (the `&&` replacement)

The user log showed `pwd && ls -la` failing — the parser explicitly rejects `&&`. Use one of:

```nu
# A: just sequential, doesn't short-circuit on failure
pwd; ls -la

# B: short-circuit using exit code via try/catch
try { npm install } catch { print 'install failed'; exit 1 }
ls -la

# C: explicit conditional on the previous command's success
let r = (do { npm install } | complete)
if $r.exit_code == 0 { ls -la } else { print $r.stderr }
```

Use **A** for "run these in order regardless of outcome", **B/C** when you must stop on failure.

## Common tasks (cross-platform, Nushell)

| Task | Command |
|---|---|
| Show current dir | `pwd` *(nu builtin)* |
| List files | `ls` *(returns a table — pipe further)* |
| List recursively | `ls **/*` |
| Read file | `open README.md` *(text/json/csv auto-parsed)* or `cat README.md` |
| Write to file | `'hello' \| save -f output.txt` |
| Append | `'more' \| save --append output.txt` |
| Find files by name | `glob '**/*.py'` |
| Search content | `rg 'pattern' .` *(if ripgrep on PATH)* or `open file.txt \| find 'pattern'` |
| Copy / move / delete | `cp a b`, `mv a b`, `rm a` |
| Make folder | `mkdir new` |
| Run npm / node / python | `npm install`, `node app.js`, `python -V` *(via PATH)* |
| Capture command output into a var | `let v = (npm -v \| str trim)` |
| Conditional on a binary existing | `if (which git \| is-empty) { print 'no git' }` |

## Workspace and paths

- The cwd is the per-workflow workspace; relative paths resolve there.
- Filesystem operations elsewhere on this tool (read/write/edit via `file_*`) honour `virtual_mode=True` and reject `..`/`~` traversal. Shell `execute()` itself is **not** path-restricted (deepagents documents this), so prefer `file_read` / `file_modify` / `fs_search` for actual filesystem work.

## Use the right tool

| Need | Tool | Why |
|---|---|---|
| List / search / one-shot file ops | **shell_execute** | Fast, in-workspace |
| Reading or editing a specific file | **file_read** / **file_modify** | Path-sandboxed, no shell parsing surprises |
| Long-running processes (dev servers, watchers, `npm run dev`) | **process_manager** | Streams output, restartable, doesn't tie up the agent |
| Recursive code search | **fs_search** | grep mode, structured results |

## Guidelines

1. **Never use `&&`, `||`, backticks, `$VAR`, or `>` redirection.** Use the Nushell equivalent on the right side of the table above.
2. **One command (or `;`-chain) per call.** No multi-line scripts; if you need control flow, use `if` / `try` / `each` inline.
3. **Short-lived only.** If the command runs longer than ~30s or is a daemon, switch to `process_manager`.
4. **Don't pre-detect the OS.** Nu syntax is identical on Windows, macOS, Linux — write one command, not platform branches.
5. **Quote glob patterns** (`'*.py'`) so Nu's `glob` builtin expands them, not the caller.
6. **Capture command exit code** with `do { … } | complete` if you need to branch on success/failure.
