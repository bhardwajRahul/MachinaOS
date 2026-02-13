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

// Platform detection
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

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
// Auto-install missing dependencies
// ============================================================================

function installPython() {
  console.log('  Installing Python 3.11+...');
  if (isWindows) {
    if (runSilent('winget --version')) {
      run('winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements');
    } else if (runSilent('choco --version')) {
      run('choco install python312 -y');
    } else {
      console.log('  Error: Please install Python manually from https://python.org/');
      console.log('  Or install winget/chocolatey first.');
      process.exit(1);
    }
  } else if (isMac) {
    if (runSilent('brew --version')) {
      run('brew install python@3.12');
    } else {
      console.log('  Error: Please install Homebrew first: https://brew.sh/');
      process.exit(1);
    }
  } else {
    // Linux package managers
    if (runSilent('apk --version')) {
      // Alpine Linux
      run('apk add --no-cache python3 py3-pip');
    } else if (runSilent('apt --version')) {
      run('sudo apt update && sudo apt install -y python3.12 python3.12-venv');
    } else if (runSilent('dnf --version')) {
      run('sudo dnf install -y python3.12');
    } else if (runSilent('pacman --version')) {
      run('sudo pacman -S --noconfirm python');
    } else {
      console.log('  Error: Please install Python manually from https://python.org/');
      process.exit(1);
    }
  }
}

function installUv(pythonCmd) {
  console.log('  Installing uv...');
  if (isWindows) {
    // Windows: use pip (simple and works)
    run(`${pythonCmd} -m pip install uv`);
  } else if (isMac) {
    // macOS: use pip (no PEP 668 issues with Homebrew Python)
    run(`${pythonCmd} -m pip install uv`);
  } else if (runSilent('apk --version')) {
    // Alpine: use pip with --break-system-packages
    run(`${pythonCmd} -m pip install uv --break-system-packages`);
  } else {
    // Other Linux: try pip first, fall back to curl installer
    if (runSilent(`${pythonCmd} -m pip install uv --break-system-packages`)) {
      // pip worked
    } else {
      run('curl -LsSf https://astral.sh/uv/install.sh | sh');
      process.env.PATH = `${process.env.HOME}/.local/bin:${process.env.PATH}`;
    }
  }
}

// Go is no longer required - whatsapp-rpc is an npm package with pre-built binaries

// ============================================================================
// Check and Install Dependencies
// ============================================================================

console.log('Checking dependencies...\n');

const nodeVersion = getVersion('node --version');
console.log(`  Node.js: ${nodeVersion}`);

const npmVersion = getVersion('npm --version');
console.log(`  npm: ${npmVersion}`);

// Python
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
      installPython();
    }
  }
} else {
  installPython();
  pyCmd = runSilent('python --version') ? 'python' : 'python3';
  console.log(`  ${getVersion(`${pyCmd} --version`)}`);
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

// Go is optional (whatsapp-rpc uses pre-built binaries)
const goVersionFull = getVersion('go version');
if (goVersionFull) {
  const goVersion = goVersionFull.match(/go\d+\.\d+(\.\d+)?/)?.[0] || 'go';
  console.log(`  Go: ${goVersion} (optional)`);
} else {
  console.log('  Go: not installed (optional - whatsapp-rpc uses pre-built binaries)');
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
