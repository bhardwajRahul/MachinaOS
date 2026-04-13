#!/usr/bin/env node
/**
 * Production start script for MachinaOS.
 * Clean output by default, --verbose for full logs.
 * Usage: machina start [--verbose|-v] [--skip-whatsapp]
 */
import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ROOT,
  isWindows,
  isWSL,
  loadEnvConfig,
  ensureEnvFile,
  killPort,
  createLogger,
} from './utils.js';

const START_TIME = Date.now();
const log = createLogger(START_TIME);

const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose') || args.includes('-v');
const skipWhatsApp = args.includes('--skip-whatsapp');

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function main() {
  // Validate build
  if (!existsSync(resolve(ROOT, 'node_modules')) || !existsSync(resolve(ROOT, 'server', '.venv'))) {
    console.error('Error: Project not built. Run "machina build" first.');
    process.exit(1);
  }
  if (!existsSync(resolve(ROOT, 'client', 'dist', 'index.html'))) {
    console.error('Error: Client not built. Run "machina build" first.');
    process.exit(1);
  }

  // Preflight: time-boxed sqlalchemy import probe.
  // On Windows, Defender's minifilter driver (MpFilter.sys) can cache stale
  // "pending scan" entries that block .pyd LoadLibrary calls even after
  // adding exclusions. See docs-internal/errors.md #1 and #1a.
  const pyExe = resolve(ROOT, 'server', '.venv', 'Scripts', isWindows ? 'python.exe' : 'python');
  const pyFallback = resolve(ROOT, 'server', '.venv', 'bin', 'python');
  const py = existsSync(pyExe) ? pyExe : pyFallback;
  if (existsSync(py)) {
    const probeStart = Date.now();
    try {
      execSync(`"${py}" -c "import sqlalchemy"`, { timeout: 15000, stdio: 'pipe' });
      const elapsed = Date.now() - probeStart;
      if (elapsed > 5000) {
        console.warn(`Warning: sqlalchemy import took ${(elapsed / 1000).toFixed(1)}s (expected <1s).`);
        console.warn('  See docs-internal/errors.md #1 for Windows Defender remediation.');
      }
    } catch (e) {
      const elapsed = Date.now() - probeStart;
      console.error(`Error: Python venv health check failed (${(elapsed / 1000).toFixed(1)}s).`);
      console.error('  sqlalchemy import hung or crashed.');
      console.error('  Likely cause: Windows Defender scan cache or stale kernel state.');
      console.error('  Fix options:');
      console.error('    1. Restart-Service WinDefend  (admin PowerShell)');
      console.error('    2. Reboot the machine');
      console.error('    3. Add D:\\...\\server\\.venv to Defender exclusions');
      console.error('  See docs-internal/errors.md #1 and #1a for details.');
      process.exit(1);
    }
  }

  const config = loadEnvConfig();
  process.env.PYTHONUTF8 = '1';
  ensureEnvFile();

  // Check if Temporal is already running via CLI
  // (temporal api exits immediately if already up, which triggers
  // --kill-others and kills all services)
  let temporalRunning = false;
  try {
    const status = execSync('temporal status', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    temporalRunning = /running|UP/i.test(status);
  } catch {
    temporalRunning = false;
  }

  if (temporalRunning) {
    log('Temporal already running, skipping');
  }

  // Free app ports
  log('Freeing ports...');
  for (const port of config.allPorts) {
    await killPort(port);
  }
  log('Ports ready');

  // Services: static client, backend (uvicorn), whatsapp, temporal
  const services = [];
  services.push(`"node ${resolve(ROOT, 'scripts', 'serve-client.js').replace(/\\/g, '/')}"`);
  services.push((isWindows || isWSL) ? '"pnpm run python:start"' : '"pnpm run python:daemon"');
  if (!skipWhatsApp) services.push('"pnpm run whatsapp:api"');
  if (!temporalRunning) services.push('"pnpm run temporal:start"');
  // Worker runs embedded in the backend (main.py TemporalWorkerManager)

  // Ready-detection patterns for each service
  const readyPatterns = [
    { name: 'Client',   pattern: /ready in|VITE.*ready|Client:\s*http/i },
    { name: 'Backend',  pattern: /Application startup complete|Uvicorn running/i },
  ];
  if (!skipWhatsApp) {
    readyPatterns.push({ name: 'WhatsApp', pattern: /listening on|WhatsApp.*ready|API.*started|:9400/i });
  }
  if (!temporalRunning) {
    readyPatterns.push({ name: 'Temporal', pattern: /\[Temporal\] Worker started|temporal.*server.*started/i });
  }
  const readySet = new Set();
  const totalExpected = readyPatterns.length;

  function checkReady(text) {
    for (const { name, pattern } of readyPatterns) {
      if (!readySet.has(name) && pattern.test(text)) {
        readySet.add(name);
        log(`${name} ready`);
        if (readySet.size === totalExpected) {
          log(`All services ready`);
        }
      }
    }
  }

  if (isVerbose) {
    console.log('\n=== MachinaOS Starting (verbose) ===\n');
    const proc = spawn('pnpm', ['exec', 'concurrently', '--raw', '--kill-others', ...services], {
      cwd: ROOT,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    proc.stdout.on('data', (data) => {
      process.stdout.write(data);
      checkReady(data.toString());
    });
    proc.stderr.on('data', (data) => process.stderr.write(data));

    process.on('SIGINT', () => proc.kill('SIGINT'));
    process.on('SIGTERM', () => proc.kill('SIGTERM'));
    proc.on('close', (code) => process.exit(code || 0));
  } else {
    // Clean banner
    const version = getVersion();
    console.log(`\n  MachinaOS v${version}`);
    console.log(`  Frontend:  http://localhost:${config.clientPort}`);
    console.log(`  Backend:   http://localhost:${config.backendPort}`);
    console.log(`  Use --verbose for full logs\n`);

    const serviceNames = ['client', 'server'];
    if (!skipWhatsApp) serviceNames.push('whatsapp');
    if (!temporalRunning) serviceNames.push('temporal');

    const proc = spawn('pnpm', [
      'exec', 'concurrently', '--kill-others',
      '-n', serviceNames.join(','),
      '-c', 'blue,green,yellow,magenta',
      ...services,
    ], {
      cwd: ROOT,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    // Show only essential output: errors, ready messages, warnings
    const essential = /error|fatal|exception|failed|started|ready|listening|running|address already in use|application startup complete|\[Temporal\]/i;

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      checkReady(text);
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && essential.test(trimmed)) {
          process.stdout.write(line + '\n');
        }
      }
    });

    // Always show stderr
    proc.stderr.on('data', (data) => process.stderr.write(data));

    process.on('SIGINT', () => proc.kill('SIGINT'));
    process.on('SIGTERM', () => proc.kill('SIGTERM'));
    proc.on('close', (code) => {
      console.log('\nServices stopped.');
      process.exit(code || 0);
    });
  }
}

main().catch(console.error);
