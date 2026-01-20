#!/usr/bin/env node
import { execSync, spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync, copyFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const START = Date.now();
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Timing helper
const elapsed = () => `${((Date.now() - START) / 1000).toFixed(2)}s`;
const log = (msg) => console.log(`[${elapsed()}] ${msg}`);

// Load ports from .env
function loadPorts() {
  const envPath = existsSync(resolve(ROOT, '.env')) ? resolve(ROOT, '.env') : resolve(ROOT, '.env.template');
  if (!existsSync(envPath)) return [3000, 3010, 9400];
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  }
  return [
    parseInt(env.VITE_CLIENT_PORT) || 3000,
    parseInt(env.PYTHON_BACKEND_PORT) || 3010,
    parseInt(env.WHATSAPP_RPC_PORT) || 9400
  ];
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

  // Kill all processes
  for (const pid of allPids) {
    if (isWindows) {
      exec(`taskkill /PID ${pid} /F /T 2>nul`);
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

const PORTS = loadPorts();
process.env.PYTHONUTF8 = '1';

console.log('\n=== MachinaOS Starting ===\n');
log(`Platform: ${isWindows ? 'Windows' : isMac ? 'macOS' : 'Linux'}`);
log(`Ports: ${PORTS.join(', ')}`);

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
spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: 'inherit', shell: true });
