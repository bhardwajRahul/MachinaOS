# CLI-Based Services Integration Guide

MachinaOS integrates external services that manage their own lifecycle via CLI tools. These services own their ports, data directories, and processes -- MachinaOS does not manage them directly.

## Principles

1. **Install globally** -- CLI tools must be available system-wide (`npm install -g <package>`)
2. **Use the CLI** -- Check status, start, stop via the package's own commands. No port-sniffing, no TCP socket checks, no hardcoded port detection.
3. **Don't manage their ports** -- External service ports are NOT added to `allPorts` in `utils.js`. MachinaOS only kills ports it owns (client, backend, WhatsApp, Node.js executor).
4. **Handle "already running"** -- Before adding a service to `concurrently`, check if it's already up. If it is, skip it. This prevents `--kill-others` cascade kills in `start.js`.
5. **Keep dependencies in package.json** -- Even if installed globally, keep the package in `dependencies` so npm scripts (`npm run temporal:start`) work.

## Integrated CLI Services

### Temporal Server (`temporal-server`)

Bundles the official Temporal CLI binary with SQLite persistence for local development.

**Install:**
```bash
npm install -g temporal-server
```

**CLI:**
```bash
temporal-server start       # Daemon (background)
temporal-server api         # Foreground (blocks)
temporal-server stop        # Stop
temporal-server status      # Show status
temporal-server restart     # Restart
temporal-server clean       # Stop + remove data
```

**Ports (managed by temporal-server, NOT by MachinaOS):**
| Service  | Port |
|----------|------|
| gRPC     | 7233 |
| HTTP API | 8233 |
| Web UI   | 8080 |
| Metrics  | 9090 |

**npm scripts:**
```json
{
  "temporal:start": "temporal-server api",
  "temporal:stop": "temporal-server stop",
  "temporal:status": "temporal-server status"
}
```

**Integration in start.js:**
```javascript
// Check CLI status before building service list
let temporalRunning = false;
try {
  const status = execSync('temporal-server status', {
    encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
  });
  temporalRunning = /running|UP/i.test(status);
} catch {
  temporalRunning = false;
}

// Only add to concurrently if NOT already running
if (!temporalRunning) services.push('npm:temporal:start');
```

**Integration in dev.js:**
No status check needed -- `dev.js` does not use `--kill-others`, so `temporal-server api` exiting early (because it's already running) is harmless.

**Integration in stop.js:**
```javascript
// Kill temporal processes by name pattern (not by port)
const temporalPids = await killByPattern('temporal');
```

**Embedded worker:**
The Temporal worker runs inside the Python backend via `TemporalWorkerManager` in `main.py` lifespan. No separate worker process needed for single-server deployments. For horizontal scaling, run standalone workers:
```bash
cd server && python -m services.temporal.worker
```

---

## Adding a New CLI Service

Follow this pattern when integrating a new external CLI service:

### 1. Install globally and add to dependencies

```bash
npm install -g <service-package>
npm install <service-package>
```

### 2. Add npm scripts in package.json

```json
{
  "<service>:start": "<service-cli> start",
  "<service>:stop": "<service-cli> stop",
  "<service>:status": "<service-cli> status"
}
```

### 3. Integrate in start.js (with --kill-others protection)

```javascript
let serviceRunning = false;
try {
  const status = execSync('<service-cli> status', {
    encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
  });
  serviceRunning = /running|UP/i.test(status);
} catch {
  serviceRunning = false;
}

if (serviceRunning) {
  log('<Service> already running, skipping');
}

// Add to services list only if not running
if (!serviceRunning) services.push('npm:<service>:start');

// Add ready-detection pattern only if not running
if (!serviceRunning) {
  readyPatterns.push({
    name: '<Service>',
    pattern: /<service>.*started|<service>.*ready/i
  });
}
```

### 4. Integrate in stop.js

```javascript
// Kill by process name pattern -- NOT by port
const pids = await killByPattern('<service>');
if (pids.length > 0) {
  console.log(`Killed ${pids.length} <service> processes`);
}
```

### 5. Do NOT add ports to allPorts

The service manages its own ports. Do not add them to `loadEnvConfig().allPorts` in `utils.js`.

### 6. dev.js -- usually no special handling needed

`dev.js` does not use `--kill-others`, so services exiting early is harmless. Just add `npm:<service>:start` to the services list unconditionally.

---

## Common Mistakes to Avoid

| Mistake | Why it's wrong | Correct approach |
|---------|---------------|-----------------|
| TCP socket check (`net.connect(port)`) | Fragile, races with other services, hardcodes ports | Use `<service-cli> status` |
| Adding service ports to `allPorts` | `killPort()` would kill the service during startup | Service manages its own ports |
| Resolving `node_modules/.bin/<cli>` path | Breaks if not in PATH, tribal workaround | Install globally |
| Using `npx <service-cli>` in `execSync` | Slow, may use wrong version, npx overhead | Install globally, call directly |
| Wrapping CLI in a JS script | Unnecessary indirection | Use CLI commands directly |
| Hardcoding port numbers for detection | Breaks if service config changes | Use CLI status command |
