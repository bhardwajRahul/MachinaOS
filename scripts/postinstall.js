#!/usr/bin/env node
/**
 * Postinstall script for MachinaOS.
 * Outputs to stderr so npm shows the progress (npm suppresses stdout during postinstall).
 *
 * Scenarios:
 * 1. npm install -g machinaos  → Run full install with output
 * 2. npm install (local)       → Run full install with output
 * 3. GitHub Actions CI         → Skip (workflow handles build separately)
 *
 * Runs:
 * 1. download-binaries.js (optional binary download)
 * 2. build.js (full build)
 */
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Output to stderr so npm shows it during install
const print = (msg) => process.stderr.write(msg + '\n');

// Environment detection
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Skip in CI - GitHub Actions workflow handles build separately
if (isCI) {
  print('CI environment detected, skipping postinstall.');
  process.exit(0);
}

print('');
print('========================================');
print('  MachinaOS - Installing...');
print('========================================');
print('');

// Run a script and pipe all output to stderr (npm shows stderr during install)
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: ROOT,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    // Pipe stdout to stderr so npm shows it
    child.stdout.on('data', (data) => process.stderr.write(data));
    child.stderr.on('data', (data) => process.stderr.write(data));

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
    // Step 1: Try to download pre-built binaries (optional, non-fatal)
    print('[1/2] Checking for pre-built binaries...');
    try {
      await runScript(resolve(__dirname, 'download-binaries.js'));
    } catch (e) {
      print('  Binary download skipped or failed, will build from source.');
    }

    // Step 2: Run the full build
    print('');
    print('[2/2] Building MachinaOS...');
    print('');
    await runScript(resolve(__dirname, 'build.js'));

    print('');
    print('========================================');
    print('  MachinaOS installed successfully!');
    print('========================================');
    print('');
    print('Run: machinaos start');
    print('Open: http://localhost:3000');
    print('');

  } catch (err) {
    print('');
    print('========================================');
    print('  Installation failed!');
    print('========================================');
    print('');
    print(`Error: ${err.message}`);
    print('');
    print('Try running manually:');
    print('  machinaos build');
    print('');
    process.exit(1);
  }
}

main();
