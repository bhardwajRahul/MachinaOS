#!/usr/bin/env node
/**
 * Common utilities for MachinaOS scripts.
 * Shared across: start.js, stop.js, clean.js, docker.js, build.js
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

// Lazy-loaded find-process (may not be available during clean)
let _findProcess = null;

/**
 * Get find-process module, loading it lazily.
 * Returns null if not available (e.g., during clean when node_modules is missing).
 */
async function getFindProcess() {
  if (_findProcess !== null) return _findProcess;
  try {
    const module = await import('find-process');
    _findProcess = module.default;
    return _findProcess;
  } catch {
    _findProcess = false; // Mark as unavailable
    return null;
  }
}

/**
 * Get human-readable platform name.
 */
export function getPlatformName() {
  if (isGitBash) return 'Git Bash';
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
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  return {
    raw: env,
    ports: {
      client: parseInt(env.VITE_CLIENT_PORT) || 3000,
      backend: parseInt(env.PYTHON_BACKEND_PORT) || 3010,
      whatsapp: parseInt(env.WHATSAPP_RPC_PORT) || 9400,
      nodejs: parseInt(env.NODEJS_EXECUTOR_PORT) || 3020,
    },
    allPorts: [
      parseInt(env.VITE_CLIENT_PORT) || 3000,
      parseInt(env.PYTHON_BACKEND_PORT) || 3010,
      parseInt(env.WHATSAPP_RPC_PORT) || 9400,
      parseInt(env.NODEJS_EXECUTOR_PORT) || 3020,
    ],
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
 * Kill process on port using native commands (fallback when find-process unavailable).
 * @returns {{ killed: boolean }}
 */
function killPortNative(port) {
  try {
    if (isWindows) {
      // Windows: use netstat + taskkill
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
        } catch {}
      }
      return { killed: pids.size > 0 };
    } else {
      // Unix: use lsof + kill
      const output = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const pids = output.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
        } catch {}
      }
      return { killed: pids.length > 0 };
    }
  } catch {
    return { killed: false };
  }
}

/**
 * Kill all processes on a specific port.
 * Uses find-process if available, falls back to native commands.
 * @returns {Promise<{ killed: number[], portFree: boolean }>}
 */
export async function killPort(port) {
  const findProcess = await getFindProcess();

  if (!findProcess) {
    // Fallback to native commands
    const result = killPortNative(port);
    return { killed: result.killed ? [0] : [], portFree: result.killed };
  }

  const procs = await findProcess('port', port);
  if (procs.length === 0) return { killed: [], portFree: true };

  const pids = procs.map(p => p.pid);

  // SIGTERM first (graceful)
  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
  await sleep(300);

  // SIGKILL for stubborn processes
  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
  await sleep(200);

  const remaining = await findProcess('port', port);
  return { killed: pids, portFree: remaining.length === 0 };
}

/**
 * Kill processes matching a name pattern.
 * @returns {Promise<number[]>} Array of killed PIDs
 */
export async function killByPattern(pattern) {
  const findProcess = await getFindProcess();
  if (!findProcess) return [];

  const procs = await findProcess('name', pattern);
  const pids = procs.map(p => p.pid);

  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
  return pids;
}

/**
 * Kill MachinaOS processes that may hold file locks.
 * Useful before cleaning directories.
 * @param {string} [excludeScript] - Script name to exclude from killing (e.g., 'clean.js')
 * @returns {Promise<Array<{pid: number, type: string}>>}
 */
export async function killMachinaProcesses(excludeScript = null) {
  const findProcess = await getFindProcess();
  if (!findProcess) {
    // Fallback: just kill by ports
    return [];
  }

  const killed = [];
  const rootNorm = normalizePath(ROOT);

  // Find Python processes running from MachinaOs directory
  const pythonProcs = await findProcess('name', 'python');
  for (const proc of pythonProcs) {
    const cmd = normalizePath(proc.cmd);
    if (cmd.includes(rootNorm)) {
      try {
        process.kill(proc.pid, 'SIGKILL');
        killed.push({ pid: proc.pid, type: 'python' });
      } catch {}
    }
  }

  // Find Node processes running from MachinaOs directory
  const nodeProcs = await findProcess('name', 'node');
  for (const proc of nodeProcs) {
    const cmd = normalizePath(proc.cmd);
    // Exclude the specified script from being killed
    const shouldExclude = excludeScript && cmd.includes(excludeScript);
    if (cmd.includes(rootNorm) && !shouldExclude) {
      try {
        process.kill(proc.pid, 'SIGKILL');
        killed.push({ pid: proc.pid, type: 'node' });
      } catch {}
    }
  }

  return killed;
}

/**
 * Kill orphaned MachinaOS processes (uvicorn, vite, nodejs executor).
 * More targeted than killMachinaProcesses - only kills specific known processes.
 * @returns {Promise<number[]>} Array of killed PIDs
 */
export async function killOrphanedProcesses() {
  const findProcess = await getFindProcess();
  if (!findProcess) return [];

  const killed = [];
  const rootNorm = normalizePath(ROOT);

  // Python processes (uvicorn/main:app)
  const pythonProcs = await findProcess('name', 'python');
  for (const proc of pythonProcs) {
    const cmd = normalizePath(proc.cmd);
    if (cmd.includes(rootNorm) && (cmd.includes('uvicorn') || cmd.includes('main:app'))) {
      try {
        process.kill(proc.pid, 'SIGKILL');
        killed.push(proc.pid);
      } catch {}
    }
  }

  // Node processes (vite, nodejs executor)
  const nodeProcs = await findProcess('name', 'node');
  for (const proc of nodeProcs) {
    const cmd = normalizePath(proc.cmd);
    if (cmd.includes(rootNorm) && (cmd.includes('vite') || cmd.includes('nodejs/src'))) {
      try {
        process.kill(proc.pid, 'SIGKILL');
        killed.push(proc.pid);
      } catch {}
    }
  }

  return killed;
}

/**
 * Create a timestamped logger.
 * @param {number} [startTime] - Start time for elapsed calculation (default: now)
 */
export function createLogger(startTime = Date.now()) {
  const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
  return (msg) => console.log(`[${elapsed()}] ${msg}`);
}
