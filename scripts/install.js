#!/usr/bin/env node
/**
 * MachinaOS Installation Script
 *
 * Called by postinstall.js after npm install.
 * Installs all dependencies including Python, uv, and builds the project.
 */
import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

process.env.PYTHONUTF8 = '1';

function run(cmd, cwd = ROOT, timeoutMs = 300000) {
  execSync(cmd, { cwd, stdio: 'inherit', shell: true, timeout: timeoutMs });
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

function checkGo() {
  const version = getVersion('go version');
  return version ? { version } : null;
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

// Check Go (optional)
const go = checkGo();
if (go) {
  console.log(`  Go: ${go.version}`);
} else {
  console.log('  Go: not found (using pre-built binary)');
}

console.log('');
console.log('Installing...');
console.log('');

try {
  // Create .env if needed
  const envPath = resolve(ROOT, '.env');
  const templatePath = resolve(ROOT, '.env.template');
  if (!existsSync(envPath) && existsSync(templatePath)) {
    copyFileSync(templatePath, envPath);
    console.log('[1/5] Created .env from template');
  } else {
    console.log('[1/5] .env exists');
  }

  // Install client dependencies
  console.log('[2/5] Installing client dependencies...');
  run('npm install', resolve(ROOT, 'client'), 600000);  // 10 min timeout

  // Build client
  console.log('[3/5] Building client...');
  run('npm run build', resolve(ROOT, 'client'), 600000);  // 10 min timeout

  // Install Python dependencies
  console.log('[4/5] Installing Python dependencies...');
  const serverDir = resolve(ROOT, 'server');
  run('uv venv', serverDir);  // 5 min default
  run('uv sync', serverDir, 600000);  // 10 min timeout

  // WhatsApp service
  console.log('[5/5] Setting up WhatsApp service...');
  const whatsappDir = resolve(ROOT, 'server/whatsapp-rpc');
  run('npm install', whatsappDir);  // 5 min default

  const binPath = resolve(whatsappDir, 'bin', isWindows ? 'whatsapp-rpc-server.exe' : 'whatsapp-rpc-server');
  if (!existsSync(binPath) && go) {
    console.log('      Building WhatsApp from source...');
    run('npm run build', whatsappDir);
  }

  console.log('');
  console.log('Done!');

} catch (err) {
  console.log('');
  console.log(`Failed: ${err.message}`);
  process.exit(1);
}
