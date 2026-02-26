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
  log(`Mode: ${isDaemonMode ? 'Daemon (Gunicorn)' : 'Development (uvicorn)'}`);
  log(`Ports: ${config.allPorts.join(', ')}`);
  log(`Temporal: ${config.temporalEnabled ? 'enabled' : 'disabled'}`);
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
  log('Starting services...');
  log('Press Ctrl+C to stop\n');

  const clientDist = resolve(ROOT, 'client', 'dist', 'index.html');
  const hasVite = existsSync(resolve(ROOT, 'node_modules', 'vite'))
    || existsSync(resolve(ROOT, 'client', 'node_modules', 'vite'));
  const isProduction = existsSync(clientDist) && !hasVite;
  log(`Mode: ${isProduction ? 'Production' : 'Development'}`);

  const services = [];
  if (isProduction) {
    services.push(`"node ${resolve(ROOT, 'scripts', 'serve-client.js').replace(/\\/g, '/')}"`);
  } else {
    services.push('npm:client:start');
  }
  services.push(isDaemonMode ? 'npm:python:daemon' : 'npm:python:start');
  if (!skipWhatsApp) services.push('npm:whatsapp:api');
  if (config.temporalEnabled) services.push('npm:temporal:worker');

  const proc = spawn('npx', ['concurrently', '--raw', '--kill-others-on-fail', ...services], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  process.on('SIGINT', () => proc.kill('SIGINT'));
  process.on('SIGTERM', () => proc.kill('SIGTERM'));
  proc.on('close', (code) => {
    console.log('\nServices stopped.');
    process.exit(code || 0);
  });
}

main().catch(console.error);
