#!/usr/bin/env node
/**
 * Cross-platform build script for MachinaOS.
 * Works on: Windows, macOS, Linux, WSL, Git Bash
 *
 * Automatically installs missing dependencies:
 * - Python 3.11+ (via winget/brew/apt)
 * - uv (Python package manager)
 * - Go (for WhatsApp service)
 */
import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Environment detection
// - postinstall: npm already installed root deps, skip to avoid infinite loop
// - CI: GitHub Actions handles build separately, skip postinstall entirely
const isPostInstall = process.env.npm_lifecycle_event === 'postinstall';
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Ensure Python UTF-8 encoding
process.env.PYTHONUTF8 = '1';

// Skip build entirely in CI (workflows handle this)
if (isCI && isPostInstall) {
  console.log('CI environment detected, skipping postinstall build.');
  process.exit(0);
}

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function runSilent(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', shell: true });
    return true;
  } catch {
    return false;
  }
}

function getVersion(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], shell: true }).trim();
  } catch {
    return null;
  }
}

function npmInstall(cwd = ROOT) {
  execSync('npm install', { cwd, stdio: 'inherit', shell: true });
}

// ============================================================================
// Install dependencies via pip
// ============================================================================

function ensurePip(pythonCmd) {
  // Check if pip exists, install via ensurepip if missing
  if (!runSilent(`${pythonCmd} -m pip --version`)) {
    console.log('  Installing pip via ensurepip...');
    run(`${pythonCmd} -m ensurepip --upgrade`);
  }
}

function installUv(pythonCmd) {
  ensurePip(pythonCmd);
  console.log('  Installing uv via pip...');
  run(`${pythonCmd} -m pip install uv`);
}

// ============================================================================
// Check and Install Dependencies
// ============================================================================

console.log('Checking dependencies...\n');

const nodeVersion = getVersion('node --version');
console.log(`  Node.js: ${nodeVersion}`);

const npmVersion = getVersion('npm --version');
console.log(`  npm: ${npmVersion}`);

// Python (required, user must install)
let pyCmd = null;
if (runSilent('python --version')) {
  pyCmd = 'python';
} else if (runSilent('python3 --version')) {
  pyCmd = 'python3';
}

if (pyCmd) {
  const pyVersion = getVersion(`${pyCmd} --version`);
  const match = pyVersion?.match(/Python (\d+)\.(\d+)/);
  if (match) {
    const [, major, minor] = match.map(Number);
    if (major >= 3 && minor >= 11) {
      console.log(`  ${pyVersion}`);
    } else {
      console.log(`  ${pyVersion} (too old, need 3.11+)`);
      console.log('  Error: Please install Python 3.11+ from https://python.org/');
      process.exit(1);
    }
  }
} else {
  console.log('  Error: Python 3.11+ is required.');
  console.log('  Install from: https://python.org/downloads/');
  process.exit(1);
}

// uv
let uvVersion = getVersion('uv --version');
if (uvVersion) {
  console.log(`  uv: ${uvVersion}`);
} else {
  installUv(pyCmd);
  uvVersion = getVersion('uv --version');
  if (uvVersion) {
    console.log(`  uv: ${uvVersion}`);
  } else {
    console.log('  Error: Failed to install uv. Please install manually.');
    console.log('  https://docs.astral.sh/uv/getting-started/installation/');
    process.exit(1);
  }
}

console.log('\nAll dependencies ready.\n');

// ============================================================================
// Build
// ============================================================================

try {
  // Step 0: Create .env if not exists
  const envPath = resolve(ROOT, '.env');
  const templatePath = resolve(ROOT, '.env.template');
  if (!existsSync(envPath) && existsSync(templatePath)) {
    copyFileSync(templatePath, envPath);
    console.log('[0/6] Created .env from template');
  }

  // Step 1: Install root dependencies (skip if postinstall - npm already did this)
  if (!isPostInstall) {
    console.log('[1/5] Installing root dependencies...');
    npmInstall(ROOT);
  } else {
    console.log('[1/5] Root dependencies already installed by npm');
  }

  // Step 2: Install client dependencies
  console.log('[2/5] Installing client dependencies...');
  npmInstall(resolve(ROOT, 'client'));

  // Step 3: Build client
  console.log('[3/5] Building client...');
  run('npm run build', resolve(ROOT, 'client'));

  // Step 4: Install Python dependencies
  console.log('[4/5] Installing Python dependencies...');
  const serverDir = resolve(ROOT, 'server');
  // Check if .venv exists, skip creation if it does
  if (!existsSync(resolve(serverDir, '.venv'))) {
    run('uv venv', serverDir);
  }
  run('uv sync', serverDir);

  // Step 5: Verify WhatsApp RPC package
  console.log('[5/5] Verifying WhatsApp RPC...');
  run('whatsapp-rpc status', ROOT);

  console.log('\nBuild complete.');

} catch (err) {
  console.log(`\nBuild failed: ${err.message}`);
  process.exit(1);
}
