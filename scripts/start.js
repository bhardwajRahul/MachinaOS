#!/usr/bin/env node
import { execSync, spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync, copyFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const START = Date.now();

// Detect environment: Git Bash on Windows reports win32 but uses Unix commands
const isGitBash = process.platform === 'win32' && (process.env.MSYSTEM || process.env.SHELL?.includes('bash'));
const isWindows = process.platform === 'win32' && !isGitBash;
const isMac = process.platform === 'darwin';

// Timing helper
const elapsed = () => `${((Date.now() - START) / 1000).toFixed(2)}s`;
const log = (msg) => console.log(`[${elapsed()}] ${msg}`);

// Load env config
function loadEnvConfig() {
  const envPath = existsSync(resolve(ROOT, '.env')) ? resolve(ROOT, '.env') : resolve(ROOT, '.env.template');
  const env = {};
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
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

// Legacy function for backwards compatibility
function loadPorts() {
  return loadEnvConfig().ports;
}

// Execute command and return output (suppressing errors)
function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

// Get PIDs using a port - Windows
function getPidsWindows(port) {
  const pids = new Set();
  const netstatOutput = exec(`netstat -ano | findstr :${port} | findstr LISTENING`);
  for (const line of netstatOutput.split('\n')) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid) && pid !== '0') {
      pids.add(pid);
    }
  }
  return Array.from(pids);
}

// Get PIDs using a port - Unix
function getPidsUnix(port) {
  const pids = new Set();
  const lsofOutput = exec(`lsof -ti:${port} -sTCP:LISTEN 2>/dev/null`);
  for (const pid of lsofOutput.split('\n')) {
    if (pid.trim() && /^\d+$/.test(pid.trim())) {
      pids.add(pid.trim());
    }
  }
  // Fallback to ss on Linux
  if (pids.size === 0 && !isMac) {
    const ssOutput = exec(`ss -tlnp 2>/dev/null | grep :${port}`);
    const matches = ssOutput.matchAll(/pid=(\d+)/g);
    for (const match of matches) {
      pids.add(match[1]);
    }
  }
  return Array.from(pids);
}

// Get child process PIDs - Windows
function getChildPidsWindows(parentPid) {
  const children = new Set();
  const wmicOutput = exec(`wmic process where (ParentProcessId=${parentPid}) get ProcessId 2>nul`);
  for (const line of wmicOutput.split('\n')) {
    const pid = line.trim();
    if (pid && /^\d+$/.test(pid)) {
      children.add(pid);
      for (const grandchild of getChildPidsWindows(pid)) {
        children.add(grandchild);
      }
    }
  }
  return Array.from(children);
}

// Get child process PIDs - Unix
function getChildPidsUnix(parentPid) {
  const children = new Set();
  const pgrepOutput = exec(`pgrep -P ${parentPid} 2>/dev/null`);
  for (const pid of pgrepOutput.split('\n')) {
    if (pid.trim() && /^\d+$/.test(pid.trim())) {
      children.add(pid.trim());
      for (const grandchild of getChildPidsUnix(pid.trim())) {
        children.add(grandchild);
      }
    }
  }
  return Array.from(children);
}

// Kill process by port thoroughly
function killPort(port) {
  const getPids = isWindows ? getPidsWindows : getPidsUnix;
  const getChildPids = isWindows ? getChildPidsWindows : getChildPidsUnix;

  let pids = getPids(port);
  if (pids.length === 0) return false;

  // Collect all PIDs including children
  const allPids = new Set(pids);
  for (const pid of pids) {
    for (const childPid of getChildPids(pid)) {
      allPids.add(childPid);
    }
  }

  // Kill all processes (no /T flag to avoid killing parent shell)
  for (const pid of allPids) {
    if (isWindows) {
      exec(`taskkill /PID ${pid} /F 2>nul`);
    } else {
      exec(`kill -9 ${pid} 2>/dev/null`);
    }
  }

  // Wait for processes to die
  if (isWindows) {
    exec('ping -n 2 127.0.0.1 >nul');
  } else {
    spawnSync('sleep', ['0.5'], { stdio: 'pipe' });
  }

  // Verify port is free
  const remainingPids = getPids(port);
  return remainingPids.length === 0;
}

const config = loadEnvConfig();
const PORTS = config.ports;
process.env.PYTHONUTF8 = '1';

console.log('\n=== MachinaOS Starting ===\n');
const platformName = isWindows ? 'Windows' : isGitBash ? 'Git Bash' : isMac ? 'macOS' : 'Linux';
log(`Platform: ${platformName}`);
log(`Ports: ${PORTS.join(', ')}`);
log(`Temporal: ${config.temporalEnabled ? 'enabled' : 'disabled'}`);

// Step 1: Create .env if not exists
const envPath = resolve(ROOT, '.env');
const templatePath = resolve(ROOT, '.env.template');
if (!existsSync(envPath) && existsSync(templatePath)) {
  copyFileSync(templatePath, envPath);
  log('Created .env from template');
}

// Step 2: Free ports
log('Freeing ports...');
let allFree = true;
for (const port of PORTS) {
  const getPids = isWindows ? getPidsWindows : getPidsUnix;
  const pids = getPids(port);
  if (pids.length > 0) {
    const freed = killPort(port);
    if (freed) {
      log(`  Port ${port}: Freed (killed PIDs: ${pids.join(', ')})`);
    } else {
      log(`  Port ${port}: Warning - could not free`);
      allFree = false;
    }
  } else {
    log(`  Port ${port}: Already free`);
  }
}

if (!allFree) {
  log('Warning: Some ports could not be freed. Services may fail to start.');
}

// Step 3: Start dev server
log('Starting services...');
log('Press Ctrl+C to stop (use npm run stop to kill all services)');
log('');

// Build the dev command - conditionally include Temporal worker
const devCommand = config.temporalEnabled ? 'npm run dev:temporal' : 'npm run dev';

// On Git Bash/mintty, Ctrl+C doesn't propagate properly to Node.js child processes
// due to Cygwin pseudo-terminal limitations. The workaround is to run concurrently
// directly without a Node.js wrapper.
//
// This script's job is done - it freed ports and set up env.
// Now exec into npm run dev so the terminal controls it directly.

if (isGitBash) {
  // For Git Bash: Use exec to replace this process with npm
  // This way Ctrl+C goes directly to npm/concurrently, not through Node.js
  const { execFileSync } = await import('child_process');
  try {
    // Use bash -c to run npm, replacing this process
    execFileSync('bash', ['-c', `exec ${devCommand}`], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: false
    });
  } catch {
    // Normal exit from Ctrl+C
  }
} else {
  // For native Windows cmd or Unix: execSync works fine
  try {
    execSync(devCommand, { cwd: ROOT, stdio: 'inherit' });
  } catch {
    // Ctrl+C causes non-zero exit, which is normal
  }
}

console.log('\nDev server stopped.');
