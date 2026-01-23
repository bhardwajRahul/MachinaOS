#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Detect environment: Git Bash on Windows reports win32 but uses Unix commands
const isGitBash = process.platform === 'win32' && (process.env.MSYSTEM || process.env.SHELL?.includes('bash'));
const isWindows = process.platform === 'win32' && !isGitBash;
const isMac = process.platform === 'darwin';

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
// Added timeout to prevent hanging
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,  // 10 second timeout to prevent hanging
      ...options
    }).trim();
  } catch {
    return '';
  }
}

// Get PIDs using a port - Windows
function getPidsWindows(port) {
  const pids = new Set();

  // Method 1: netstat (most reliable)
  const netstatOutput = exec(`netstat -ano | findstr :${port} | findstr LISTENING`);
  for (const line of netstatOutput.split('\n')) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid) && pid !== '0') {
      pids.add(pid);
    }
  }

  // Method 2: PowerShell Get-NetTCPConnection (backup)
  if (pids.size === 0) {
    const psOutput = exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`);
    for (const pid of psOutput.split('\n')) {
      if (pid.trim() && /^\d+$/.test(pid.trim()) && pid.trim() !== '0') {
        pids.add(pid.trim());
      }
    }
  }

  return Array.from(pids);
}

// Get PIDs using a port - Unix (Linux/macOS)
function getPidsUnix(port) {
  const pids = new Set();

  // Method 1: lsof (most common)
  const lsofOutput = exec(`lsof -ti:${port} -sTCP:LISTEN 2>/dev/null`);
  for (const pid of lsofOutput.split('\n')) {
    if (pid.trim() && /^\d+$/.test(pid.trim())) {
      pids.add(pid.trim());
    }
  }

  // Method 2: ss (Linux, if lsof not available)
  if (pids.size === 0 && !isMac) {
    const ssOutput = exec(`ss -tlnp 2>/dev/null | grep :${port}`);
    const matches = ssOutput.matchAll(/pid=(\d+)/g);
    for (const match of matches) {
      pids.add(match[1]);
    }
  }

  // Method 3: fuser (Linux fallback)
  if (pids.size === 0 && !isMac) {
    const fuserOutput = exec(`fuser ${port}/tcp 2>/dev/null`);
    for (const pid of fuserOutput.split(/\s+/)) {
      if (pid.trim() && /^\d+$/.test(pid.trim())) {
        pids.add(pid.trim());
      }
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
      // Recursively get grandchildren
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
  // pgrep -P gets direct children
  const pgrepOutput = exec(`pgrep -P ${parentPid} 2>/dev/null`);
  for (const pid of pgrepOutput.split('\n')) {
    if (pid.trim() && /^\d+$/.test(pid.trim())) {
      children.add(pid.trim());
      // Recursively get grandchildren
      for (const grandchild of getChildPidsUnix(pid.trim())) {
        children.add(grandchild);
      }
    }
  }
  return Array.from(children);
}

// Kill a single PID - Windows
// NOTE: Removed /T flag (tree kill) as it can kill the parent PowerShell terminal
// Child processes are killed explicitly via getChildPidsWindows() instead
function killPidWindows(pid) {
  // First try graceful termination (no /T)
  exec(`taskkill /PID ${pid} 2>nul`);
  // Then force kill (no /T)
  exec(`taskkill /PID ${pid} /F 2>nul`);
}

// Cross-platform sleep using Atomics (efficient, no busy wait)
function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Kill a single PID - Unix
function killPidUnix(pid) {
  // First try SIGTERM (graceful)
  exec(`kill -15 ${pid} 2>/dev/null`);
  // Give it a moment
  sleepMs(100);
  // Then SIGKILL (force)
  exec(`kill -9 ${pid} 2>/dev/null`);
}

// Check if process is still running
function isProcessRunning(pid) {
  if (isWindows) {
    const output = exec(`tasklist /FI "PID eq ${pid}" 2>nul`);
    return output.includes(pid);
  } else {
    // Use kill -0 via exec (returns empty string on error = process dead)
    const output = exec(`kill -0 ${pid} 2>&1 && echo "running"`);
    return output.includes('running');
  }
}

// Kill all processes on a port with verification
function killPort(port) {
  const getPids = isWindows ? getPidsWindows : getPidsUnix;
  const getChildPids = isWindows ? getChildPidsWindows : getChildPidsUnix;
  const killPid = isWindows ? killPidWindows : killPidUnix;

  // Get all PIDs on this port
  let pids = getPids(port);
  if (pids.length === 0) {
    return { killed: false, pids: [], portFree: true, message: 'Free' };
  }

  // Collect all PIDs including children
  const allPids = new Set(pids);
  for (const pid of pids) {
    for (const childPid of getChildPids(pid)) {
      allPids.add(childPid);
    }
  }

  const pidsToKill = Array.from(allPids);
  const killedPids = [];

  // Kill all processes
  for (const pid of pidsToKill) {
    killPid(pid);
  }

  // Wait a bit for processes to die
  sleepMs(500);

  // Verify which ones are actually dead
  for (const pid of pidsToKill) {
    if (!isProcessRunning(pid)) {
      killedPids.push(pid);
    }
  }

  // Retry for stubborn processes
  const stillRunning = pidsToKill.filter(pid => isProcessRunning(pid));
  if (stillRunning.length > 0) {
    for (const pid of stillRunning) {
      // Force kill again (no /T flag to avoid killing parent shell)
      if (isWindows) {
        exec(`taskkill /PID ${pid} /F 2>nul`);
      } else {
        exec(`kill -9 ${pid} 2>/dev/null`);
      }
    }

    // Final check
    sleepMs(500);

    for (const pid of stillRunning) {
      if (!isProcessRunning(pid)) {
        killedPids.push(pid);
      }
    }
  }

  // Final verification - check if port is actually free
  const remainingPids = getPids(port);
  const portFree = remainingPids.length === 0;

  return {
    killed: killedPids.length > 0,
    pids: killedPids,
    portFree,
    message: portFree
      ? (killedPids.length > 0 ? `Killed ${killedPids.length} process(es)` : 'Free')
      : `Warning: Port still in use by PID(s): ${remainingPids.join(', ')}`
  };
}

// Main execution
const PORTS = loadPorts();

console.log('Stopping MachinaOs services...\n');
const platformName = isWindows ? 'Windows' : isGitBash ? 'Git Bash' : isMac ? 'macOS' : 'Linux';
console.log(`Platform: ${platformName}`);
console.log(`Ports: ${PORTS.join(', ')}\n`);

let allStopped = true;

for (const port of PORTS) {
  const result = killPort(port);
  const status = result.portFree ? '[OK]' : '[!!]';
  console.log(`${status} Port ${port}: ${result.message}`);
  if (result.pids.length > 0) {
    console.log(`    PIDs: ${result.pids.join(', ')}`);
  }
  if (!result.portFree) {
    allStopped = false;
  }
}

console.log('');
if (allStopped) {
  console.log('All services stopped successfully.');
} else {
  console.log('Warning: Some ports may still be in use.');
  console.log('Try running the script again or manually kill the processes.');
  process.exit(1);
}
