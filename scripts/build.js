#!/usr/bin/env node
/**
 * Cross-platform build script for MachinaOS.
 * Works on: Windows, macOS, Linux, WSL, Git Bash
 */
import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Ensure Python UTF-8 encoding
process.env.PYTHONUTF8 = '1';

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function check(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', shell: true });
    return true;
  } catch {
    return false;
  }
}

function getVersion(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', shell: true }).trim();
  } catch {
    return null;
  }
}

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function npmInstall(cwd = ROOT) {
  // Try npm ci first (fast), fall back to npm install if lock file out of sync
  try {
    execSync('npm ci', { cwd, stdio: 'pipe', shell: true });
  } catch {
    execSync('npm install', { cwd, stdio: 'inherit', shell: true });
  }
}

// ============================================================================
// Check Dependencies
// ============================================================================

console.log('Checking dependencies...\n');

const missing = [];

// Node.js
const nodeVersion = getVersion('node --version');
if (nodeVersion) {
  console.log(`  Node.js: ${nodeVersion}`);
} else {
  missing.push('Node.js - https://nodejs.org/');
}

// npm
const npmVersion = getVersion('npm --version');
if (npmVersion) {
  console.log(`  npm: ${npmVersion}`);
} else {
  missing.push('npm - comes with Node.js');
}

// Python
let pyCmd = null;
if (check('python --version')) {
  pyCmd = 'python';
} else if (check('python3 --version')) {
  pyCmd = 'python3';
}
if (pyCmd) {
  const pyVersion = getVersion(`${pyCmd} --version`);
  console.log(`  ${pyVersion}`);
} else {
  missing.push('Python 3.11+ - https://python.org/');
}

// uv (Python package manager)
const uvVersion = getVersion('uv --version');
if (uvVersion) {
  console.log(`  uv: ${uvVersion}`);
} else {
  missing.push('uv - https://docs.astral.sh/uv/getting-started/installation/');
}

// Go (required for WhatsApp server)
const goVersionFull = getVersion('go version');
if (goVersionFull) {
  const goVersion = goVersionFull.match(/go\d+\.\d+(\.\d+)?/)?.[0] || 'go';
  console.log(`  Go: ${goVersion}`);
} else {
  missing.push('Go - https://go.dev/dl/');
}

if (missing.length > 0) {
  console.error('\nMissing required dependencies:\n');
  for (const dep of missing) {
    console.error(`  - ${dep}`);
  }
  console.error('\nPlease install the missing dependencies and try again.');
  process.exit(1);
}

console.log('\nAll dependencies found.\n');

// ============================================================================
// Build
// ============================================================================

try {
  // Step 0: Create .env if not exists
  const envPath = resolve(ROOT, '.env');
  const templatePath = resolve(ROOT, '.env.template');
  if (!existsSync(envPath) && existsSync(templatePath)) {
    copyFileSync(templatePath, envPath);
    log('0/5', 'Created .env from template');
  }

  // Step 1: Install root dependencies
  log('1/5', 'Installing root dependencies...');
  npmInstall(ROOT);

  // Step 2: Build client
  log('2/5', 'Building client...');
  run('npm run build', resolve(ROOT, 'client'));

  // Step 3: Install Python dependencies
  log('3/5', 'Installing Python dependencies...');
  const serverDir = resolve(ROOT, 'server');
  run('uv venv', serverDir);
  run('uv sync', serverDir);

  // Step 4: Install WhatsApp dependencies
  log('4/5', 'Installing WhatsApp dependencies...');
  const whatsappDir = resolve(ROOT, 'server/whatsapp-rpc');
  npmInstall(whatsappDir);

  // Step 5: Build WhatsApp server (Go binary)
  log('5/5', 'Building WhatsApp server...');
  run('npm run build', whatsappDir);

  console.log('\nBuild complete.');

} catch (err) {
  console.error('\nBuild failed:', err.message);
  process.exit(1);
}
