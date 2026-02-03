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

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

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

function installPython() {
  console.log('Installing Python 3.11+...');
  if (isWindows) {
    // choco is pre-installed on GitHub Actions Windows runners
    // winget is only on windows-2025, not windows-2022 (windows-latest)
    if (runSilent('choco --version')) {
      run('choco install python312 -y');
    } else if (runSilent('winget --version')) {
      run('winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements --disable-interactivity');
    } else {
      console.log('ERROR: Cannot auto-install Python. Please install manually:');
      console.log('  https://python.org/downloads/');
      process.exit(1);
    }
  } else if (isMac) {
    if (runSilent('brew --version')) {
      run('brew install python@3.12');
    } else {
      console.log('ERROR: Homebrew not found. Install it first:');
      console.log('  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
      process.exit(1);
    }
  } else {
    // Linux - try package managers
    if (runSilent('apt-get --version')) {
      run('apt-get update && apt-get install -y python3 python3-venv python3-pip curl');
    } else if (runSilent('dnf --version')) {
      run('dnf install -y python3 python3-pip');
    } else if (runSilent('pacman --version')) {
      run('pacman -S --noconfirm python python-pip');
    } else if (runSilent('apk --version')) {
      run('apk add --no-cache python3 py3-pip');
    } else {
      console.log('ERROR: Cannot auto-install Python. Please install manually:');
      console.log('  https://python.org/downloads/');
      process.exit(1);
    }
  }
}

function installUv(pythonCmd) {
  console.log('Installing uv...');
  if (isWindows) {
    // Use pip on Windows (no PEP 668 issues)
    run(`${pythonCmd} -m pip install uv`);
  } else if (isMac) {
    // Use pip on macOS (no PEP 668 issues with Homebrew Python)
    run(`${pythonCmd} -m pip install uv`);
  } else {
    // Linux: use official installer (avoids PEP 668 externally-managed-environment)
    run('curl -LsSf https://astral.sh/uv/install.sh | sh');
    process.env.PATH = `${process.env.HOME}/.local/bin:${process.env.PATH}`;
  }
}

// ============================================================================
// Main
// ============================================================================

console.log('');
console.log('Checking dependencies...');
console.log('');
console.log(`  Node.js: ${getVersion('node --version')}`);
console.log(`  npm: ${getVersion('npm --version')}`);

// Check/Install Python
let python = checkPython();
if (python) {
  console.log(`  Python: ${python.version}`);
} else {
  installPython();
  python = checkPython();
  if (python) {
    console.log(`  Python: ${python.version}`);
  } else {
    console.log('ERROR: Python installation failed');
    process.exit(1);
  }
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

// Go is optional (whatsapp-rpc uses pre-built binaries via npm)
const goVersion = getVersion('go version');
if (goVersion) {
  console.log(`  Go: ${goVersion.match(/go\d+\.\d+(\.\d+)?/)?.[0] || 'installed'} (optional)`);
} else {
  console.log('  Go: not installed (optional - whatsapp-rpc uses pre-built binaries)');
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
  run('uv venv', serverDir);  // 5 min default
  run('uv sync', serverDir, 600000);  // 10 min timeout

  // WhatsApp RPC is now an npm dependency - binary downloaded via postinstall
  console.log('');
  console.log('Done!');
  console.log('');
  console.log('WhatsApp RPC installed as npm dependency (@trohitg/whatsapp-rpc)');

} catch (err) {
  console.log('');
  console.log(`Failed: ${err.message}`);
  process.exit(1);
}
