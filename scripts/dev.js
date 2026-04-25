#!/usr/bin/env node
/**
 * Development server for MachinaOS.
 * Vite HMR, uvicorn hot-reload, full log output.
 * Usage: machina dev [--daemon] [--skip-whatsapp]
 */
import { spawn } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import {
  ROOT,
  getPlatformName,
  loadEnvConfig,
  ensureEnvFile,
  killPort,
  createLogger,
  waitForTcpPort,
} from './utils.js';

const START_TIME = Date.now();
const log = createLogger(START_TIME);

// Parse command line arguments
const args = process.argv.slice(2);
const isDaemonMode = args.includes('--daemon');
const skipWhatsApp = args.includes('--skip-whatsapp');

async function main() {
  // Check if build has been run
  const rootNodeModules = resolve(ROOT, 'node_modules');
  const pythonVenv = resolve(ROOT, 'server', '.venv');
  if (!existsSync(rootNodeModules) || !existsSync(pythonVenv)) {
    console.error('\nError: Project not built. Run "npm run build" first.\n');
    process.exit(1);
  }

  const config = loadEnvConfig();
  process.env.PYTHONUTF8 = '1';

  console.log('\n=== MachinaOS Starting ===\n');
  log(`Platform: ${getPlatformName()}`);
  log(`Mode: ${isDaemonMode ? 'Daemon (uvicorn)' : 'Development (uvicorn)'}`);
  log(`Ports: ${config.allPorts.join(', ')}`);
  log(`Temporal: enabled`);
  log(`WhatsApp: ${skipWhatsApp ? 'skipped' : 'enabled'}`);

  // Create .env if not exists
  if (ensureEnvFile()) {
    log('Ensured .env file exists');
  }

  // Free ports
  log('Freeing ports...');
  for (const port of config.allPorts) {
    const result = await killPort(port);
    if (result.killed.length > 0) {
      log(`  Port ${port}: ${result.portFree ? 'Freed' : 'Warning - could not free'} (PIDs: ${result.killed.join(', ')})`);
    } else {
      log(`  Port ${port}: Already free`);
    }
  }

  // Clear Vite dependency cache to prevent "Outdated Optimize Dep" errors
  const viteCachePath = resolve(ROOT, 'client', 'node_modules', '.vite');
  if (existsSync(viteCachePath)) {
    try {
      rmSync(viteCachePath, { recursive: true, force: true });
      log('Cleared Vite cache');
    } catch (err) {
      log(`Warning: Could not clear Vite cache: ${err.message}`);
    }
  }

  // Start services
  log('Spawning services...');

  const clientDist = resolve(ROOT, 'client', 'dist', 'index.html');
  const hasVite = existsSync(resolve(ROOT, 'node_modules', 'vite'))
    || existsSync(resolve(ROOT, 'client', 'node_modules', 'vite'));
  const isProduction = existsSync(clientDist) && !hasVite;
  log(`Client: ${isProduction ? 'Static server' : 'Vite dev server'}`);

  const services = [];
  if (isProduction) {
    services.push(`"node ${resolve(ROOT, 'scripts', 'serve-client.js').replace(/\\/g, '/')}"`);
  } else {
    services.push('"pnpm run client:start"');
  }
  services.push(isDaemonMode ? '"pnpm run python:daemon"' : '"pnpm run python:start"');
  if (!skipWhatsApp) services.push('"pnpm run whatsapp:api"');
  services.push('"pnpm run temporal:start"');
  // Worker runs embedded in the backend (main.py TemporalWorkerManager)

  // No --kill-others: uvicorn hot-reloads (exit code 1) would cascade-kill frontend
  const proc = spawn('pnpm', ['exec', 'concurrently', '--raw', ...services], {
    cwd: ROOT,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  // Pass-through stdout/stderr so each service's logs reach the terminal.
  proc.stdout.on('data', (data) => process.stdout.write(data));
  proc.stderr.on('data', (data) => process.stderr.write(data));

  // Detect ready state by probing TCP ports (the same primitive used by
  // the wait-on package, Vercel CLI dev scripts, etc.). Replaces the
  // previous stdout regex-matching, which trailed actual readiness by
  // ~2s due to line-buffered stdout flush + Temporal worker startup
  // gating the "Worker started" log line.
  const readyTargets = [
    { name: 'Client',   port: config.clientPort },
    { name: 'Backend',  port: config.backendPort },
  ];
  if (!skipWhatsApp) {
    readyTargets.push({ name: 'WhatsApp', port: config.ports.whatsapp });
  }
  readyTargets.push({ name: 'Temporal', port: config.ports.temporal });

  Promise.all(
    readyTargets.map(async ({ name, port }) => {
      const ok = await waitForTcpPort(port);
      log(ok ? `${name} ready (port ${port})` : `${name} did not become ready (port ${port})`);
      return ok;
    })
  ).then((results) => {
    if (results.every(Boolean)) {
      log(`All services ready -- http://localhost:${config.clientPort}`);
      console.log('');
    }
  });

  process.on('SIGINT', () => proc.kill('SIGINT'));
  process.on('SIGTERM', () => proc.kill('SIGTERM'));
  proc.on('close', (code) => {
    console.log('\nServices stopped.');
    process.exit(code || 0);
  });
}

main().catch(console.error);
