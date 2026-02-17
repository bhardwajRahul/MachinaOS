#!/usr/bin/env node
/**
 * MachinaOS Installation Script
 *
 * Called by postinstall.js after npm install.
 * Installs all dependencies including Python and uv.
 * WhatsApp RPC is now an npm dependency with pre-built binaries.
 */
import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Prevent recursive execution when npm install runs in subdirectories
if (process.env.MACHINAOS_INSTALLING === 'true') {
  process.exit(0);
}
process.env.MACHINAOS_INSTALLING = 'true';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

process.env.PYTHONUTF8 = '1';

function run(cmd, cwd = ROOT, timeoutMs = 300000) {
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    shell: true,
    timeout: timeoutMs,
    env: { ...process.env, MACHINAOS_INSTALLING: 'true' }
  });
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

function checkPython() {
  for (const cmd of ['python3', 'python']) {
    const version = getVersion(`${cmd} --version`);
    if (version) {
      const match = version.match(/Python (\d+)\.(\d+)/);
      if (match) {
        const [, major, minor] = match.map(Number);
        if (major >= 3 && minor >= 11) {
          return { cmd, version };
        }
      }
    }
  }
  return null;
}

function checkUv() {
  return getVersion('uv --version');
}

function ensurePip(pythonCmd) {
  // Check if pip exists, install via ensurepip if missing
  if (!runSilent(`${pythonCmd} -m pip --version`)) {
    console.log('Installing pip via ensurepip...');
    run(`${pythonCmd} -m ensurepip --upgrade`);
  }
}

function installUv(pythonCmd) {
  ensurePip(pythonCmd);
  console.log('Installing uv via pip...');
  run(`${pythonCmd} -m pip install uv`);
}

// ============================================================================
// Main
// ============================================================================

console.log('');
console.log('Checking dependencies...');
console.log('');
console.log(`  Node.js: ${getVersion('node --version')}`);
console.log(`  npm: ${getVersion('npm --version')}`);

// Check Python (required, user must install)
let python = checkPython();
if (python) {
  console.log(`  Python: ${python.version}`);
} else {
  console.log('ERROR: Python 3.11+ is required.');
  console.log('  Install from: https://python.org/downloads/');
  process.exit(1);
}

// Check/Install uv
let uvVersion = checkUv();
if (uvVersion) {
  console.log(`  uv: ${uvVersion}`);
} else {
  installUv(python.cmd);
  uvVersion = checkUv();
  if (uvVersion) {
    console.log(`  uv: ${uvVersion}`);
  } else {
    console.log('ERROR: uv installation failed');
    process.exit(1);
  }
}

console.log('');
console.log('Installing...');
console.log('');

try {
  const clientDir = resolve(ROOT, 'client');
  const serverDir = resolve(ROOT, 'server');
  const clientDistExists = existsSync(resolve(clientDir, 'dist', 'index.html'));

  // Calculate total steps
  let totalSteps = 1;  // .env always
  if (!clientDistExists) totalSteps += 2;  // client deps + build
  totalSteps += 1;  // Python deps always
  let step = 0;

  // Create .env if needed
  step++;
  const envPath = resolve(ROOT, '.env');
  const templatePath = resolve(ROOT, '.env.template');
  if (!existsSync(envPath) && existsSync(templatePath)) {
    copyFileSync(templatePath, envPath);
    console.log(`[${step}/${totalSteps}] Created .env from template`);
  } else {
    console.log(`[${step}/${totalSteps}] .env exists`);
  }

  // Skip client install/build if dist already exists (pre-built in npm package)
  if (clientDistExists) {
    console.log(`[SKIP] Client already built (dist/index.html exists)`);
  } else {
    // Install client dependencies
    step++;
    console.log(`[${step}/${totalSteps}] Installing client dependencies...`);
    run('npm install', clientDir, 600000);  // 10 min timeout

    // Build client
    step++;
    console.log(`[${step}/${totalSteps}] Building client...`);
    run('npm run build', clientDir, 600000);  // 10 min timeout
  }

  // Install Python dependencies (always needed - venv not included in package)
  step++;
  console.log(`[${step}/${totalSteps}] Installing Python dependencies...`);
  // Check if .venv exists, skip creation if it does
  const venvPath = resolve(serverDir, '.venv');
  if (!existsSync(venvPath)) {
    run('uv venv', serverDir);  // 5 min default
  }
  run('uv sync', serverDir, 600000);  // 10 min timeout

  // WhatsApp RPC is now an npm dependency - binary downloaded via postinstall
  console.log('');
  console.log('Done!');
  console.log('');
  console.log('WhatsApp RPC installed as npm dependency (whatsapp-rpc)');

} catch (err) {
  console.log('');
  console.log(`Failed: ${err.message}`);
  process.exit(1);
}
