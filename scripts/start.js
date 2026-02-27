#!/usr/bin/env node
/**
 * Production start script for MachinaOS.
 * Clean output by default, --verbose for full logs.
 * Usage: machina start [--verbose|-v] [--skip-whatsapp]
 */
import { spawn } from 'child_process';
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

  const config = loadEnvConfig();
  process.env.PYTHONUTF8 = '1';
  ensureEnvFile();

  // Free ports
  log('Freeing ports...');
  for (const port of config.allPorts) {
    await killPort(port);
  }
  log('Ports ready');

  // Services: static client, backend (uvicorn), whatsapp, temporal
  const services = [];
  services.push(`"node ${resolve(ROOT, 'scripts', 'serve-client.js').replace(/\\/g, '/')}"`);
  services.push((isWindows || isWSL) ? 'npm:python:start' : 'npm:python:daemon');
  if (!skipWhatsApp) services.push('npm:whatsapp:api');
  if (config.temporalEnabled) services.push('npm:temporal:worker');

  // Ready-detection patterns for each service
  const readyPatterns = [
    { name: 'Client',   pattern: /ready in|VITE.*ready|Client:\s*http/i },
    { name: 'Backend',  pattern: /Application startup complete|Uvicorn running/i },
  ];
  if (!skipWhatsApp) {
    readyPatterns.push({ name: 'WhatsApp', pattern: /listening on|WhatsApp.*ready|API.*started|:9400/i });
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
    const proc = spawn('npx', ['concurrently', '--raw', '--kill-others', ...services], {
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
    if (config.temporalEnabled) serviceNames.push('temporal');

    const proc = spawn('npx', [
      'concurrently', '--kill-others',
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
    const essential = /error|fatal|exception|failed|started|ready|listening|running|address already in use|application startup complete/i;

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
