#!/usr/bin/env node
/**
 * Cross-platform stop script for MachinaOS services.
 * Works on: Windows, macOS, Linux, WSL, Git Bash
 *
 * Uses Node.js native APIs where possible, with platform-specific
 * fallbacks for process management (no cross-platform alternative exists).
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ============================================================================
// Platform Detection
// ============================================================================
const isWindows = process.platform === 'win32';
const isGitBash = isWindows && (process.env.MSYSTEM || process.env.SHELL?.includes('bash'));
const isMac = process.platform === 'darwin';

// Git Bash on Windows uses Unix commands
const useUnixCommands = !isWindows || isGitBash;

function getPlatformName() {
  if (isGitBash) return 'Git Bash';
  if (isWindows) return 'Windows';
  if (isMac) return 'macOS';
  return 'Linux';
}

// ============================================================================
// Utilities
// ============================================================================

/** Execute command silently, return output or empty string */
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: options.timeout || 10000,
      cwd: ROOT,
      ...options
    }).trim();
  } catch {
    return '';
  }
}

/** Cross-platform sleep using Atomics (efficient, no busy wait) */
function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // Fallback for older Node.js
    const end = Date.now() + ms;
    while (Date.now() < end) { /* spin */ }
  }
}

/** Load config from .env file */
function loadConfig() {
  const envPath = existsSync(resolve(ROOT, '.env'))
    ? resolve(ROOT, '.env')
    : resolve(ROOT, '.env.template');

  const env = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  return {
    ports: [
      parseInt(env.VITE_CLIENT_PORT) || 3000,
      parseInt(env.PYTHON_BACKEND_PORT) || 3010,
      parseInt(env.WHATSAPP_RPC_PORT) || 9400
    ],
    temporalEnabled: env.TEMPORAL_ENABLED?.toLowerCase() === 'true'
  };
}

// ============================================================================
// Process Management (platform-specific - no cross-platform alternative)
// ============================================================================

/** Get PIDs listening on a port */
function getPidsOnPort(port) {
  const pids = new Set();

  if (useUnixCommands) {
    // lsof (macOS/Linux/Git Bash)
    const lsofOutput = exec(`lsof -ti:${port} -sTCP:LISTEN 2>/dev/null`);
    for (const pid of lsofOutput.split('\n')) {
      if (pid.trim() && /^\d+$/.test(pid.trim())) {
        pids.add(pid.trim());
      }
    }
    // ss fallback (Linux)
    if (pids.size === 0 && !isMac && !isGitBash) {
      const ssOutput = exec(`ss -tlnp 2>/dev/null | grep :${port}`);
      for (const match of ssOutput.matchAll(/pid=(\d+)/g)) {
        pids.add(match[1]);
      }
    }
  } else {
    // netstat (Windows native)
    const output = exec(`netstat -ano | findstr :${port} | findstr LISTENING`);
    for (const line of output.split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') {
        pids.add(pid);
      }
    }
  }

  return Array.from(pids);
}

/** Get child PIDs recursively */
function getChildPids(parentPid) {
  const children = new Set();

  if (useUnixCommands) {
    const output = exec(`pgrep -P ${parentPid} 2>/dev/null`);
    for (const pid of output.split('\n')) {
      if (pid.trim() && /^\d+$/.test(pid.trim())) {
        children.add(pid.trim());
        for (const grandchild of getChildPids(pid.trim())) {
          children.add(grandchild);
        }
      }
    }
  } else {
    const output = exec(`wmic process where (ParentProcessId=${parentPid}) get ProcessId 2>nul`);
    for (const line of output.split('\n')) {
      const pid = line.trim();
      if (pid && /^\d+$/.test(pid)) {
        children.add(pid);
        for (const grandchild of getChildPids(pid)) {
          children.add(grandchild);
        }
      }
    }
  }

  return Array.from(children);
}

/** Check if process is running */
function isRunning(pid) {
  if (useUnixCommands) {
    return exec(`kill -0 ${pid} 2>&1 && echo running`).includes('running');
  } else {
    return exec(`tasklist /FI "PID eq ${pid}" 2>nul`).includes(pid);
  }
}

/** Kill a single process */
function killPid(pid) {
  if (useUnixCommands) {
    exec(`kill -15 ${pid} 2>/dev/null`);
    sleep(100);
    exec(`kill -9 ${pid} 2>/dev/null`);
  } else {
    exec(`taskkill /PID ${pid} 2>nul`);
    exec(`taskkill /PID ${pid} /F 2>nul`);
  }
}

/** Kill all processes on a port */
function killPort(port) {
  const pids = getPidsOnPort(port);
  if (pids.length === 0) {
    return { killed: [], portFree: true };
  }

  // Collect all PIDs including children
  const allPids = new Set(pids);
  for (const pid of pids) {
    for (const child of getChildPids(pid)) {
      allPids.add(child);
    }
  }

  // Kill all
  for (const pid of allPids) {
    killPid(pid);
  }

  sleep(500);

  // Verify
  const killed = [];
  for (const pid of allPids) {
    if (!isRunning(pid)) {
      killed.push(pid);
    }
  }

  // Retry stubborn ones
  const stillRunning = Array.from(allPids).filter(pid => isRunning(pid));
  if (stillRunning.length > 0) {
    for (const pid of stillRunning) {
      if (useUnixCommands) {
        exec(`kill -9 ${pid} 2>/dev/null`);
      } else {
        exec(`taskkill /PID ${pid} /F 2>nul`);
      }
    }
    sleep(500);
    for (const pid of stillRunning) {
      if (!isRunning(pid)) {
        killed.push(pid);
      }
    }
  }

  return {
    killed,
    portFree: getPidsOnPort(port).length === 0
  };
}

/** Kill processes by command pattern */
function killByPattern(pattern, debug = false) {
  const killed = [];

  if (useUnixCommands) {
    const output = exec(`pgrep -f "${pattern}" 2>/dev/null`);
    if (debug && output) console.log(`  [DEBUG] pgrep output: ${output}`);
    for (const pid of output.split('\n')) {
      if (pid.trim() && /^\d+$/.test(pid.trim())) {
        exec(`kill -9 ${pid.trim()} 2>/dev/null`);
        killed.push(pid.trim());
      }
    }
  } else {
    // Use tasklist with image name filter first for Python processes
    if (pattern.includes('uvicorn') || pattern.includes('python')) {
      const pythonPids = exec(`wmic process where "name='python.exe'" get ProcessId,CommandLine 2>nul`);
      if (debug && pythonPids) console.log(`  [DEBUG] Python processes:\n${pythonPids}`);

      for (const line of pythonPids.split('\n')) {
        if (line.toLowerCase().includes(pattern.toLowerCase().replace('.*', ''))) {
          const pidMatch = line.match(/(\d+)\s*$/);
          if (pidMatch) {
            const pid = pidMatch[1];
            exec(`taskkill /PID ${pid} /F 2>nul`);
            killed.push(pid);
          }
        }
      }
    }

    // Also try the original pattern match
    const output = exec(`wmic process where "CommandLine like '%${pattern.replace('.*', '%')}%'" get ProcessId 2>nul`);
    if (debug && output) console.log(`  [DEBUG] wmic pattern output: ${output}`);
    for (const line of output.split('\n')) {
      const pid = line.trim();
      if (pid && /^\d+$/.test(pid) && !killed.includes(pid)) {
        exec(`taskkill /PID ${pid} /F 2>nul`);
        killed.push(pid);
      }
    }
  }

  return killed;
}

// ============================================================================
// Main
// ============================================================================

const config = loadConfig();

console.log('Stopping MachinaOS services...\n');
console.log(`Platform: ${getPlatformName()}`);
console.log(`Ports: ${config.ports.join(', ')}`);
console.log(`Temporal: ${config.temporalEnabled ? 'enabled' : 'disabled'}\n`);

let allStopped = true;

// Stop services on ports
for (const port of config.ports) {
  const result = killPort(port);
  const status = result.portFree ? '[OK]' : '[!!]';
  const message = result.portFree
    ? (result.killed.length > 0 ? `Killed ${result.killed.length} process(es)` : 'Free')
    : 'Warning: Port still in use';

  console.log(`${status} Port ${port}: ${message}`);
  if (result.killed.length > 0) {
    console.log(`    PIDs: ${result.killed.join(', ')}`);
  }
  if (!result.portFree) {
    allStopped = false;
  }
}

// Kill Temporal workers if enabled (must include project path)
if (config.temporalEnabled) {
  const temporalPids = killByPattern(`${ROOT}.*temporal`);
  if (temporalPids.length > 0) {
    console.log(`[OK] Temporal: Killed ${temporalPids.length} process(es)`);
    console.log(`    PIDs: ${temporalPids.join(', ')}`);
  }
}

console.log('');
if (allStopped) {
  console.log('All services stopped.');
} else {
  console.log('Warning: Some ports may still be in use.');
  console.log('Try running the script again or manually kill the processes.');
  process.exit(1);
}
