#!/usr/bin/env node
/**
 * Postinstall script for MachinaOS.
 *
 * Runs:
 * 1. download-binaries.js (download pre-built WhatsApp binary)
 * 2. install.js (check deps, install npm/Python packages, build)
 */
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

if (isCI) {
  console.log('CI detected, skipping postinstall.');
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

async function main() {
  try {
    // Download pre-built binaries (optional, non-fatal)
    console.log('[1/2] Downloading pre-built binaries...');
    try {
      await runScript(resolve(__dirname, 'download-binaries.js'));
    } catch (e) {
      console.log('  Skipped (will build from source if Go available)');
    }

    // Run full installation
    console.log('');
    console.log('[2/2] Installing...');
    await runScript(resolve(__dirname, 'install.js'));

    console.log('');
    console.log('========================================');
    console.log('  MachinaOS installed successfully!');
    console.log('========================================');
    console.log('');
    console.log('Run: machinaos start');
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
    console.log('Try: machinaos build');
    console.log('');
    process.exit(1);
  }
}

main();
