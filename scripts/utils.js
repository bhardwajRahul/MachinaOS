#!/usr/bin/env node
/**
 * Common utilities for MachinaOS scripts.
 * Shared across: start.js, stop.js, clean.js, docker.js, build.js
 *
 * Port/process killing uses Python psutil exclusively (native OS APIs,
 * no shell pipes, works in all terminals including Git Bash on Windows).
 */
import { readFileSync, existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Root directory (parent of scripts/)
const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');

// Platform detection
export const isWindows = process.platform === 'win32';
export const isGitBash = isWindows && (process.env.MSYSTEM || process.env.SHELL?.includes('bash'));

// WSL detection: Linux process but project lives on Windows filesystem (/mnt/)
export const isWSL = !isWindows && process.platform === 'linux' && (
  !!process.env.WSL_DISTRO_NAME ||
  !!process.env.WSLENV ||
  ROOT.startsWith('/mnt/')
);

// True when we should use Windows-style venv paths (Scripts/python.exe)
// WSL excluded: even with a Windows venv, WSL should prefer system python3
// for port management (Windows python.exe via interop gives wrong process info)
export const useWindowsVenv = isWindows && !isWSL;

// Cached Python path (undefined = not checked, null = unavailable, string = path)
let _pythonCmd;

/**
 * Get human-readable platform name.
 */
export function getPlatformName() {
  if (isGitBash) return 'Git Bash';
  if (isWSL) return 'WSL';
  if (isWindows) return 'Windows';
  if (process.platform === 'darwin') return 'macOS';
  return 'Linux';
}

/**
 * Sleep for specified milliseconds.
 */
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Normalize path for cross-platform comparison.
 */
export function normalizePath(p) {
  return p?.toLowerCase().replace(/\\/g, '/') || '';
}

/**
 * Load configuration from .env file.
 * Falls back to .env.template if .env doesn't exist.
 */
export function loadEnvConfig() {
  const envPath = existsSync(resolve(ROOT, '.env'))
    ? resolve(ROOT, '.env')
    : resolve(ROOT, '.env.template');

  const env = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        // Strip inline comments (but not inside quoted values)
        if (!value.startsWith('"') && !value.startsWith("'")) {
          value = value.replace(/\s+#.*$/, '');
        }
        env[match[1].trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  const clientPort = parseInt(env.VITE_CLIENT_PORT) || 3000;
  const backendPort = parseInt(env.PYTHON_BACKEND_PORT) || 3010;
  const whatsappPort = parseInt(env.WHATSAPP_RPC_PORT) || 9400;
  const nodejsPort = parseInt(env.NODEJS_EXECUTOR_PORT) || 3020;

  return {
    raw: env,
    ports: { client: clientPort, backend: backendPort, whatsapp: whatsappPort, nodejs: nodejsPort },
    allPorts: [clientPort, backendPort, whatsappPort, nodejsPort],
    clientPort,
    backendPort,
    temporalEnabled: env.TEMPORAL_ENABLED?.toLowerCase() === 'true',
    redisEnabled: ['true', '1', 'yes'].includes(env.REDIS_ENABLED?.toLowerCase()),
  };
}

/**
 * Ensure .env file exists, copying from .env.template if needed.
 * @returns {boolean} True if .env exists (or was created)
 */
export function ensureEnvFile() {
  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) return true;

  const templatePath = resolve(ROOT, '.env.template');
  if (existsSync(templatePath)) {
    copyFileSync(templatePath, envPath);
    return true;
  }

  return false;
}

/**
 * Check if a Python executable has psutil available.
 * If not, attempts to install it via pip.
 * @returns {boolean}
 */
function ensurePsutil(pythonCmd) {
  try {
    execSync(`${pythonCmd} -c "import psutil"`, { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    try {
      execSync(`${pythonCmd} -m pip install psutil>=6.0.0 --quiet`, { timeout: 30000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Find a Python executable that has psutil available.
 * Checks venv first, then system. Attempts pip install if psutil missing.
 * Result is cached -- only runs once per process.
 * @returns {string|null}
 */
function findPython() {
  if (_pythonCmd !== undefined) return _pythonCmd;

  // Check project venv first
  // On WSL with Windows filesystem, try both Windows-style and Linux-style venv paths
  const venvCandidates = useWindowsVenv
    ? [
        resolve(ROOT, 'server', '.venv', 'Scripts', 'python.exe'),
        resolve(ROOT, 'server', '.venv', 'bin', 'python3'),
      ]
    : [resolve(ROOT, 'server', '.venv', 'bin', 'python3')];

  for (const venvPython of venvCandidates) {
    try {
      execSync(`"${venvPython}" --version`, { timeout: 5000, stdio: 'pipe' });
      if (ensurePsutil(`"${venvPython}"`)) {
        _pythonCmd = venvPython;
        return _pythonCmd;
      }
    } catch {}
  }

  // Fall back to system python
  const systemCmd = isWindows ? 'python' : 'python3';
  try {
    execSync(`${systemCmd} --version`, { timeout: 5000, stdio: 'pipe' });
    if (ensurePsutil(systemCmd)) {
      _pythonCmd = systemCmd;
      return _pythonCmd;
    }
  } catch {}

  _pythonCmd = null;
  return null;
}

/**
 * Native port killing fallback (no Python required).
 * Runs netstat/lsof WITHOUT shell pipes (the pipes caused Git Bash hangs).
 * Parses output in JavaScript instead.
 * @returns {{ killed: number[], portFree: boolean }}
 */
function killPortNative(port) {
  const killed = [];
  try {
    let pids;
    if (isWindows) {
      // netstat -ano alone does NOT hang -- the pipe to findstr was the problem
      const output = execSync('netstat -ano', { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
      pids = new Set();
      const portStr = `:${port}`;
      for (const line of output.split('\n')) {
        if (!line.includes(portStr)) continue;
        // Format: "  TCP    0.0.0.0:3010    0.0.0.0:0    LISTENING    1234"
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const localAddr = parts[1] || '';
          if (localAddr.endsWith(portStr)) {
            const pid = parseInt(parts[parts.length - 1]);
            if (pid > 0) pids.add(pid);
          }
        }
      }
    } else {
      // macOS/Linux: lsof -ti :PORT returns PIDs directly, no pipe needed
      try {
        const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
        pids = new Set(output.trim().split('\n').map(s => parseInt(s.trim())).filter(n => n > 0));
      } catch {
        pids = new Set();
      }
    }

    for (const pid of pids) {
      try {
        if (isWindows) {
          execSync(`taskkill /PID ${pid} /F`, { timeout: 5000, stdio: 'pipe' });
        } else {
          execSync(`kill -9 ${pid}`, { timeout: 5000, stdio: 'pipe' });
        }
        killed.push(pid);
      } catch {}
    }
  } catch {}

  // Re-check if the port is actually free after killing
  if (killed.length > 0) {
    try {
      let stillInUse = false;
      if (isWindows) {
        const recheck = execSync('netstat -ano', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
        const portStr = `:${port}`;
        for (const line of recheck.split('\n')) {
          if (line.includes(portStr) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            if (parts[1]?.endsWith(portStr)) { stillInUse = true; break; }
          }
        }
      } else {
        try {
          execSync(`lsof -ti :${port}`, { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] });
          stillInUse = true;
        } catch {
          stillInUse = false; // lsof exits non-zero when no process found
        }
      }
      return { killed, portFree: !stillInUse };
    } catch {
      return { killed, portFree: true }; // Assume freed if verification fails
    }
  }
  return { killed, portFree: true }; // No processes found = port was already free
}

/**
 * Kill all processes on a specific port.
 * Primary: Python psutil (native OS APIs, no shell pipes).
 * Fallback: netstat/lsof parsed in JS (no shell pipes either).
 * @returns {Promise<{ killed: number[], portFree: boolean }>}
 */
export async function killPort(port) {
  const python = findPython();
  if (!python) {
    return killPortNative(port);
  }

  try {
    const scriptPath = resolve(__dirname, 'port_kill.py');
    const output = execSync(
      `"${python}" "${scriptPath}" --kill-port ${port}`,
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const result = JSON.parse(output.trim());
    if (result.error) return killPortNative(port);
    const portResult = result.results?.[0];
    const killedList = portResult?.killed || [];
    return {
      killed: killedList.map(k => k.pid),
      portFree: true,
    };
  } catch {
    return killPortNative(port);
  }
}

/**
 * Kill MachinaOS processes that may hold file locks.
 * @param {string} [excludeScript] - Script name to exclude from killing (e.g., 'clean.js')
 * @returns {Promise<Array<{pid: number, type: string}>>}
 */
export async function killMachinaProcesses(excludeScript = null) {
  const python = findPython();
  if (!python) return [];

  try {
    const scriptPath = resolve(__dirname, 'port_kill.py');
    const excludeArg = excludeScript ? ` --exclude "${excludeScript}"` : '';
    const output = execSync(
      `"${python}" "${scriptPath}" --kill-machina --root "${ROOT}"${excludeArg}`,
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const result = JSON.parse(output.trim());
    if (result.error) return [];
    return (result.killed || []).map(k => ({ pid: k.pid, type: k.name }));
  } catch {
    return [];
  }
}

/**
 * Kill orphaned MachinaOS processes (uvicorn, vite, nodejs executor).
 * Uses killMachinaProcesses under the hood.
 * @returns {Promise<number[]>} Array of killed PIDs
 */
export async function killOrphanedProcesses() {
  const killed = await killMachinaProcesses();
  return killed.map(k => k.pid);
}

/**
 * Kill processes matching a name pattern.
 * @returns {Promise<number[]>} Array of killed PIDs
 */
export async function killByPattern(pattern) {
  // Pattern-based killing handled by killMachinaProcesses for project processes
  // For specific patterns like 'temporal', use psutil process iteration
  const python = findPython();
  if (!python) return [];

  try {
    const scriptPath = resolve(__dirname, 'port_kill.py');
    const output = execSync(
      `"${python}" "${scriptPath}" --kill-pattern "${pattern}" --root "${ROOT}"`,
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const result = JSON.parse(output.trim());
    if (result.error) return [];
    return (result.killed || []).map(k => k.pid);
  } catch {
    return [];
  }
}

/**
 * Create a timestamped logger.
 * @param {number} [startTime] - Start time for elapsed calculation (default: now)
 */
export function createLogger(startTime = Date.now()) {
  const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
  return (msg) => console.log(`[${elapsed()}] ${msg}`);
}
