#!/usr/bin/env node
/**
 * Cross-platform stop script for MachinaOS services.
 * Uses find-process npm package for reliable cross-platform port detection.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import findProcess from 'find-process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const isGitBash = isWindows && (process.env.MSYSTEM || process.env.SHELL?.includes('bash'));

function getPlatformName() {
  if (isGitBash) return 'Git Bash';
  if (isWindows) return 'Windows';
  if (process.platform === 'darwin') return 'macOS';
  return 'Linux';
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

async function killPort(port) {
  const procs = await findProcess('port', port);
  if (procs.length === 0) return { killed: [], portFree: true };

  const pids = procs.map(p => p.pid);

  // SIGTERM first
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

async function killByPattern(pattern) {
  const procs = await findProcess('name', pattern);
  const pids = procs.map(p => p.pid);

  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
  return pids;
}

// Normalize path for cross-platform comparison
function normalizePath(p) {
  return p?.toLowerCase().replace(/\\/g, '/') || '';
}

// Kill orphaned MachinaOs processes that may hold database locks
async function killOrphanedMachinaProcesses() {
  const killed = [];
  const rootNorm = normalizePath(ROOT);

  // Find Python processes running from MachinaOs directory
  const pythonProcs = await findProcess('name', 'python');
  for (const proc of pythonProcs) {
    const cmd = normalizePath(proc.cmd);
    // Only kill if command includes our project path AND is uvicorn/main:app
    if (cmd.includes(rootNorm) && (cmd.includes('uvicorn') || cmd.includes('main:app'))) {
      try {
        process.kill(proc.pid, 'SIGKILL');
        killed.push(proc.pid);
      } catch {}
    }
  }

  // Find Node processes running from MachinaOs directory (vite, nodejs executor)
  const nodeProcs = await findProcess('name', 'node');
  for (const proc of nodeProcs) {
    const cmd = normalizePath(proc.cmd);
    // Only kill if command includes our project path AND is vite or nodejs executor
    if (cmd.includes(rootNorm) && (cmd.includes('vite') || cmd.includes('nodejs/src'))) {
      try {
        process.kill(proc.pid, 'SIGKILL');
        killed.push(proc.pid);
      } catch {}
    }
  }

  return killed;
}

async function main() {
  const config = loadConfig();

  console.log('Stopping MachinaOS services...\n');
  console.log(`Platform: ${getPlatformName()}`);
  console.log(`Ports: ${config.ports.join(', ')}`);
  console.log(`Temporal: ${config.temporalEnabled ? 'enabled' : 'disabled'}\n`);

  let allStopped = true;

  for (const port of config.ports) {
    const result = await killPort(port);
    const status = result.portFree ? '[OK]' : '[!!]';
    const message = result.portFree
      ? (result.killed.length > 0 ? `Killed ${result.killed.length} process(es)` : 'Free')
      : 'Warning: Port still in use';

    console.log(`${status} Port ${port}: ${message}`);
    if (result.killed.length > 0) {
      console.log(`    PIDs: ${result.killed.join(', ')}`);
    }
    if (!result.portFree) allStopped = false;
  }

  if (config.temporalEnabled) {
    const temporalPids = await killByPattern('temporal');
    if (temporalPids.length > 0) {
      console.log(`[OK] Temporal: Killed ${temporalPids.length} process(es)`);
    }
  }

  // Kill orphaned MachinaOs processes (may hold DB locks after crash)
  const orphanedPids = await killOrphanedMachinaProcesses();
  if (orphanedPids.length > 0) {
    await sleep(200);
    console.log(`[OK] Orphaned: Killed ${orphanedPids.length} MachinaOs process(es)`);
    console.log(`    PIDs: ${orphanedPids.join(', ')}`);
  }

  console.log('');
  if (allStopped) {
    console.log('All services stopped.');
  } else {
    console.log('Warning: Some ports may still be in use.');
    process.exit(1);
  }
}

main().catch(console.error);
