# Known Errors & Troubleshooting

Documented root causes and fixes for errors encountered in MachinaOs development and production.

---

## 1. SQLAlchemy Import Hang / Exit Code 15 (Windows)

**Symptom**: One of two failures when Python imports SQLAlchemy on Windows:

- **Hang**: Backend startup produces no output after `Importing DI container + all services...`. Process is alive (CPU idle or low) but `import sqlalchemy` never returns. Port 3010 is never bound.
- **Exit 15**: `uv run` fails instantly with `error: Querying Python at '...\.venv\Scripts\python.exe' failed with exit status exit code: 15`. Or direct invocation: `venv/Scripts/python.exe -c "print('hello')"` succeeds but `venv/Scripts/python.exe -c "import sqlalchemy"` exits with code 15 and no output.

**Root cause**: Windows Defender's in-process antimalware scan interface. Defender injects `MpOav.dll` (Microsoft Antimalware On-access scanning) and `amsi.dll` (Antimalware Scan Interface) into every process on the system, including Python. When Python calls `LoadLibraryW()` on a `.pyd` (Cython C extension), the loader invokes `MpOav.dll` via an AMSI hook, which synchronously requests a scan verdict from the Defender engine. SQLAlchemy imports 6 `.pyd` files back-to-back (`_greenlet`, `collections`, `immutabledict`, `processors`, `resultproxy`, `util`), so each `import sqlalchemy` triggers 6 AMSI scans.

Two failure modes follow from this:

- **Hang**: When the Defender engine is in a bad state (signature update in progress, engine reload, queue saturated from an earlier burst), the AMSI scan request blocks. `LoadLibrary()` is synchronous, so Python waits forever on the first scan that stalls.
- **Exit 15**: When AMSI returns a "block" verdict (e.g., a heuristic false-positive on a Cython `.pyd`), Windows terminates the process externally via `TerminateProcess()`. The exit code surfaces as 15. This is not a Python launcher code (the launcher only emits 100-107; see [CPython PC/launcher.c](https://github.com/python/cpython/blob/main/PC/launcher.c)) and not a signal (Windows has no SIGTERM) -- it is an external kill.

**Verification that Defender is the injector**: While a Python process is running, check its loaded modules:

```bash
tasklist //M //FI "imagename eq python.exe"
```

Expected presence of `MpOav.dll` and `amsi.dll` alongside Python's own DLLs confirms Defender has hooked the process.

**Contributing factors** (amplify the above, not independent causes):
- Larger venvs and more `.pyd` extensions = more AMSI scans per import = higher probability of hitting a bad-state scan
- Git worktrees that duplicate the full `.venv/` tree multiply the on-disk file count Defender has to keep metadata for; it does not cause the hang on its own, but does worsen the burst behaviour
- Killing hung Python via `Stop-Process` does not help -- the next attempt hits the same bad Defender state

**Fix** (reliable): **Reboot**. Resets the AMSI session state and Defender engine, clears any stuck scan queue. This is what consistently works in practice.

**Fix** (try first if admin is available): Restart the Defender or prefetch service:

```powershell
# Often blocked by Tamper Protection even as admin
Restart-Service WinDefend

# Usually allowed; sometimes clears related state
Restart-Service SysMain -Force
```

If `Restart-Service WinDefend` is blocked, disable Tamper Protection in Settings -> Windows Security -> Virus & threat protection -> Manage settings, restart the service, then re-enable. Otherwise reboot.

**Prevention** (partial, not guaranteed): Add Defender exclusions for the venv and the Python binary:

```powershell
Add-MpPreference -ExclusionPath "D:\startup\projects\MachinaOs\server\.venv"
Add-MpPreference -ExclusionProcess "python.exe"
```

Exclusions are evaluated per-scan; they reduce per-import scan load but do not evict in-flight scan state, so they help prevent future hangs more than they recover from an active one. A reboot or service restart may still be needed after adding exclusions to clear whatever state triggered the original hang.

**Retracted theory**: An earlier version of this document blamed the `MpFilter.sys` minifilter driver's kernel-mode scan-verdict cache and pinned the root cause on nested git worktrees. That theory has no external corroboration (the user confirmed a hang on a worktree that was already a sibling of the project root, not nested inside it). The observed data -- `MpOav.dll` + `amsi.dll` loaded in every Python process, exit code 15 matching external `TerminateProcess`, reboot being the reliable fix -- matches the AMSI in-process hook mechanism, not a kernel-filter cache. Git worktree nesting is a disk-usage multiplier, not the cause.

**External references**:
- [astral-sh/uv#14508](https://github.com/astral-sh/uv/issues/14508) - uv maintainer: "almost always due to overzealous antivirus blocking execution of python.exe"
- [astral-sh/uv#12612](https://github.com/astral-sh/uv/issues/12612), [#15302](https://github.com/astral-sh/uv/issues/15302), [#14563](https://github.com/astral-sh/uv/issues/14563) - similar DLL-injection symptoms from other Windows security products (SecuPrint, AuthenticateLicense, Astrill VPN)
- [astral-sh/uv#14582](https://github.com/astral-sh/uv/pull/14582) - uv added `SetUnhandledExceptionFilter` because Windows no longer surfaces access-violation dialogs, which is why these kills can appear as silent "exit code N" with no output

**Preflight** (`scripts/start.js`): A preflight probe times `import sqlalchemy`. If it exceeds 8 seconds, it fails fast with actionable remediation steps instead of letting uvicorn hang silently.

---

## 2. Temporal `context canceled` / `UpdateTaskQueue` Errors

**Symptom**: Temporal server logs show recurring errors even when no workflows are running:
```
level=ERROR msg="Operation failed with internal error."
error="UpdateTaskQueue failed. Failed to start transaction. Error: context canceled"
component=matching-engine wf-namespace=temporal-system
```

**Root cause**: Temporal's SQLite database runs in DELETE journal mode by default, which allows only one writer at a time. Temporal's internal system workflows (namespace replication, queue metadata maintenance, backlog counters) contend for write access. When multiple internal workflows try to update task queue metadata concurrently, `BeginTx` blocks, the gRPC context deadline elapses, and the transaction is cancelled.

**Fix**: Enable WAL (Write-Ahead Logging) mode via `--sqlite-pragma` flags. This is configured in the `temporal-server` npm package (v0.0.10+) via `configs/server.json`:

```json
{
  "sqlitePragma": ["journal_mode=wal", "busy_timeout=5000"]
}
```

- `journal_mode=wal` -- concurrent read/write access instead of single-writer DELETE mode
- `busy_timeout=5000` -- wait up to 5s for a write lock instead of failing immediately

After changing the pragma config, delete the existing `temporal.db` so the new DB is created with WAL mode from the start:

```bash
temporal stop
rm <temporal-server-package>/data/temporal.db
temporal start
```

**Verification**: After restart, check the metrics endpoint. `persistence_error_with_type` counters for `serviceerror_Unavailable` should stop incrementing:
```bash
curl -s http://localhost:9090/metrics | grep "persistence_error_with_type" | grep "Unavailable"
```

WAL mode is confirmed when `.db-wal` and `.db-shm` sidecar files appear next to `temporal.db`.

---

## 3. Temporal Activity `CancelledError` on Long-Running Nodes

**Symptom**: Nodes that run for more than ~2 minutes (Deep Agent, browser automation, AI multi-tool loops) fail with:
```
asyncio.exceptions.CancelledError
```
in the Temporal activity at `activities.py` line `async for msg in ws:`.

The Temporal UI shows the activity failed with `TIMEOUT_TYPE_HEARTBEAT`.

**Root cause**: The activity WebSocket read loop only sent heartbeats when a non-matching WebSocket message arrived. During long-running operations where the backend processes internally without broadcasting any WS messages, no heartbeats fire. Temporal's 2-minute `heartbeat_timeout` expires and cancels the activity.

**Fix** (applied in activities.py): Replace the `async for msg in ws:` iterator with an explicit `asyncio.wait_for(ws.receive(), timeout=30.0)` loop. On timeout (no message in 30s), a heartbeat fires and the loop continues. This guarantees heartbeats every 30 seconds regardless of WebSocket traffic.

```python
# Before (broken for long-running nodes):
async for msg in ws:
    if msg.type == aiohttp.WSMsgType.TEXT:
        response = json.loads(msg.data)
        if response.get("request_id") == request_id:
            return response
        activity.heartbeat(f"Waiting for {node_id}")  # Only fires on messages

# After (heartbeats even when no messages arrive):
while True:
    try:
        msg = await asyncio.wait_for(ws.receive(), timeout=30.0)
    except asyncio.TimeoutError:
        activity.heartbeat(f"Waiting for {node_id}")  # Fires every 30s guaranteed
        continue
    # ... handle msg
```

Also changed `receive_timeout=540` to `receive_timeout=None` on `ws_connect()` -- the old 9-minute aiohttp-level timeout was a second hard cap that could kill activities independently of the heartbeat mechanism. Liveness is now managed entirely by Temporal heartbeats.

**Timeout configuration reference**:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `start_to_close_timeout` | 10 min | Maximum total time for an activity (workflow.py) |
| `heartbeat_timeout` | 2 min | Maximum gap between heartbeats before Temporal cancels (workflow.py) |
| `asyncio.wait_for` timeout | 30s | Periodic heartbeat interval in the WS read loop (activities.py) |
| `ws_connect heartbeat` | 30s | WebSocket protocol-level ping/pong keepalive (activities.py) |
| `receive_timeout` | None | No aiohttp-level hard cap (was 540s) |

---

## 4. WhatsApp RPC Timeout

**Symptom**: Backend logs show:
```
WhatsApp RPC timeout - Go service not responding at ws://localhost:9400/ws/rpc
```

WhatsApp service health check (`/health`) returns 200 OK, but the WebSocket RPC connection fails.

**Root cause**: The RPCClient WebSocket connect timeout was set to 2.0 seconds (`routers/whatsapp.py`). The Go whatsmeow service's WebSocket handshake can take 2-3 seconds on Windows, especially on cold start or when Defender is scanning the binary. A 2.1s handshake exceeds the 2.0s deadline.

**Fix**: Increased the connect timeout from 2.0s to 5.0s in `RPCClient.connect()`:

```python
self.ws = await asyncio.wait_for(
    websockets.connect(self.url, ping_interval=30, max_size=100*1024*1024),
    timeout=5.0  # Was 2.0 -- too tight for Windows cold start
)
```

**Note**: This was also triggered by upgrading `edgymeow` from 0.0.18 to 0.0.19, where the newer Go binary had a slightly slower WebSocket handshake. Reverted to 0.0.18 pending investigation of the Go-side slowdown. The 5.0s timeout fix is correct regardless of version.

---

## 5. `ERR_CONNECTION_REFUSED` on Frontend Auth Check

**Symptom**: After `pnpm run dev`, browser console shows repeated errors:
```
GET http://localhost:3010/api/auth/status net::ERR_CONNECTION_REFUSED
Failed to check auth status (attempt 4/6): TypeError: Failed to fetch
```

**Root cause**: The FastAPI lifespan blocks on Temporal client connection (`await temporal_client_wrapper.connect(retries=10, delay=3.0)`) for up to 30 seconds. During this window, uvicorn has not called `yield` yet, so it is not accepting HTTP connections. The frontend retry window (1+2+4+8+16 = 31s) barely overlaps with the blocking window and can exhaust before the backend starts serving.

**Fix**: Move the Temporal initialization into a background `asyncio.create_task()` so the lifespan yields immediately. WorkflowService falls back to parallel/sequential execution until Temporal connects in the background. See the stashed refactor in `git stash list` for the implementation.

**Workaround** (if the refactor is not applied): Increase the frontend retry count or delay in `AuthContext.tsx`, or ensure `temporal-server` is already running before starting the Python backend.

---

## 6. `temporal-server` Binary Not Found

**Symptom**:
```
Binary not found. Run: npm run postinstall
```

**Root cause**: The `temporal-server` npm package downloads the Temporal CLI binary (~60MB) during its `postinstall` script. If `pnpm install` was interrupted, if `--ignore-scripts` was used, or if a previous install was corrupted, the binary at `<package>/bin/temporal.exe` is missing.

**Fix**:
```bash
# Re-run the postinstall download
npx --no-install temporal postinstall

# Or reinstall the package
pnpm install
```

---

## 7. Python Version Mismatch Warning

**Symptom**: Every `uv run` command shows:
```
warning: `VIRTUAL_ENV=C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.13...`
does not match the project environment path `.venv` and will be ignored
```

**Root cause**: A parent process (e.g., Claude Code's harness) leaked a `VIRTUAL_ENV` environment variable pointing to the Windows Store Python 3.13 installation. This is NOT a virtualenv -- it's a system Python install directory incorrectly set as `VIRTUAL_ENV`.

**Impact**: None. uv correctly ignores the leaked env var and uses the project's `.venv` (Python 3.12.8). The warning is cosmetic noise from the parent shell environment.

**Fix**: Unset the variable in your shell:
```bash
unset VIRTUAL_ENV
```

Or start a fresh terminal that doesn't inherit from the Claude Code harness.

---

## 8. `install.js` Python Version Check Accepts 3.13+

**Symptom**: `scripts/install.js` reports `Python: Python 3.13.7` as valid, but `pyproject.toml` requires `>=3.11,<3.13`.

**Root cause**: The version check at `install.js:59` uses `minor >= 12` with no upper bound:
```js
if (major >= 3 && minor >= 12) { return { cmd, version }; }
```

This accepts Python 3.13, 3.14, etc. even though the project constraint is `<3.13`.

**Impact**: Low -- `uv sync` independently enforces `requires-python` from `pyproject.toml` and downloads a compatible Python (3.12.x) regardless of what `install.js` reports. The user sees misleading output but the .venv is built correctly.

**Fix**: Update the check to match `pyproject.toml`:
```js
if (major === 3 && minor >= 11 && minor < 13) { return { cmd, version }; }
```
