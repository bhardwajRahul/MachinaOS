#!/usr/bin/env node
/**
 * Cross-platform start script for MachinaOS services.
 * Works on: Windows, macOS, Linux, WSL, Git Bash
 */
import { spawn } from 'child_process';
import { readFileSync, existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import findProcess from 'find-process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const START_TIME = Date.now();

// Parse command line arguments
const args = process.argv.slice(2);
const isDaemonMode = args.includes('--daemon');
const skipWhatsApp = args.includes('--skip-whatsapp');

// Platform detection
const isWindows = process.platform === 'win32';
const isGitBash = isWindows && (process.env.MSYSTEM || process.env.SHELL?.includes('bash'));

function getPlatformName() {
  if (isGitBash) return 'Git Bash';
  if (isWindows) return 'Windows';
  if (process.platform === 'darwin') return 'macOS';
  return 'Linux';
}

// Utilities
const elapsed = () => `${((Date.now() - START_TIME) / 1000).toFixed(2)}s`;
const log = (msg) => console.log(`[${elapsed()}] ${msg}`);
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

// Port Management using find-process (cross-platform)
async function freePort(port) {
  const procs = await findProcess('port', port);
  if (procs.length === 0) return { freed: true, pids: [] };

  const pids = procs.map(p => p.pid);
  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
  await sleep(300);

  // Force kill if still running
  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
  await sleep(200);

  const remaining = await findProcess('port', port);
  return { freed: remaining.length === 0, pids };
}

// Main
async function main() {
  // Check if build has been run
  const rootNodeModules = resolve(ROOT, 'node_modules');
  const pythonVenv = resolve(ROOT, 'server', '.venv');
  if (!existsSync(rootNodeModules) || !existsSync(pythonVenv)) {
    console.error('\nError: Project not built. Run "npm run build" first.\n');
    process.exit(1);
  }

  const config = loadConfig();
  process.env.PYTHONUTF8 = '1';

  console.log('\n=== MachinaOS Starting ===\n');
  log(`Platform: ${getPlatformName()}`);
  log(`Mode: ${isDaemonMode ? 'Daemon (Gunicorn)' : 'Development (uvicorn)'}`);
  log(`Ports: ${config.ports.join(', ')}`);
  log(`Temporal: ${config.temporalEnabled ? 'enabled' : 'disabled'}`);
  log(`WhatsApp: ${skipWhatsApp ? 'skipped' : 'enabled'}`);

  // Create .env if not exists
  const envPath = resolve(ROOT, '.env');
  const templatePath = resolve(ROOT, '.env.template');
  if (!existsSync(envPath) && existsSync(templatePath)) {
    copyFileSync(templatePath, envPath);
    log('Created .env from template');
  }

  // Free ports using find-process (cross-platform)
  log('Freeing ports...');
  for (const port of config.ports) {
    const result = await freePort(port);
    if (result.pids.length > 0) {
      log(`  Port ${port}: ${result.freed ? 'Freed' : 'Warning - could not free'} (PIDs: ${result.pids.join(', ')})`);
    } else {
      log(`  Port ${port}: Already free`);
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
