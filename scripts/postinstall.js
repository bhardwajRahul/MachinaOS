#!/usr/bin/env node
/**
 * Postinstall script for MachinaOS.
 *
 * Runs install.js to check deps, install npm/Python packages, build.
 * WhatsApp RPC is now an npm dependency - binary downloaded by its own postinstall.
 */
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, chmodSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Fix executable permissions on Unix (npm doesn't preserve them from git)
function fixPermissions() {
  if (process.platform === 'win32') return;

  const files = [
    resolve(ROOT, 'bin/cli.js'),
    resolve(ROOT, 'scripts/install.js'),
    resolve(ROOT, 'install.sh'),
  ];

  for (const file of files) {
    if (existsSync(file)) {
      try {
        chmodSync(file, 0o755);
      } catch (e) {
        // Ignore permission errors
      }
    }
  }
}

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isBuilding = process.env.MACHINAOS_BUILDING === 'true';

if (isCI) {
  console.log('CI detected, skipping postinstall.');
  process.exit(0);
}

if (isBuilding) {
  // build.js is orchestrating -- skip install.js to avoid duplicate work
  fixPermissions();
  process.exit(0);
}

console.log('');
console.log('========================================');
console.log('  MachinaOS - Installing...');
console.log('========================================');
console.log('');

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
  });
}

function runPython(args) {
  return new Promise((resolveP, reject) => {
    const cmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolveP();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function main() {
  try {
    // Fix executable permissions on Unix
    fixPermissions();

    // Run full installation
    console.log('Installing dependencies...');
    await runScript(resolve(__dirname, 'install.js'));

    // Install the machina CLI into whatever python is on PATH (system,
    // conda, or active venv). Idempotent: re-runs are no-ops since pip
    // detects the editable install. Fail-soft: a missing Python
    // interpreter doesn't block the rest of npm install.
    console.log('Installing machina CLI (python -m pip install -e ./machina)...');
    try {
      await runPython(['-m', 'pip', 'install', '-e', resolve(ROOT, 'machina'),
                       '--quiet', '--disable-pip-version-check']);
    } catch (err) {
      console.log(`Warning: machina CLI install skipped (${err.message}).`);
      console.log('         Install manually with: python -m pip install -e ./machina');
    }

    console.log('');
    console.log('========================================');
    console.log('  MachinaOS installed successfully!');
    console.log('========================================');
    console.log('');
    console.log('Run: machina start');
    console.log('Open: http://localhost:3000');
    console.log('');

  } catch (err) {
    console.log('');
    console.log('========================================');
    console.log('  Installation failed!');
    console.log('========================================');
    console.log('');
    console.log(`Error: ${err.message}`);
    console.log('');
    console.log('Try: machina build');
    console.log('');
    process.exit(1);
  }
}

main();
