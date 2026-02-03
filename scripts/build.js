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
    if (runSilent('apt --version')) {
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

function installUv() {
  console.log('  Installing uv...');
  if (isWindows) {
    run('powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"');
  } else {
    run('curl -LsSf https://astral.sh/uv/install.sh | sh');
  }
  if (isWindows) {
    process.env.PATH = `${process.env.USERPROFILE}\\.local\\bin;${process.env.PATH}`;
  } else {
    process.env.PATH = `${process.env.HOME}/.local/bin:${process.env.PATH}`;
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
  installUv();
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
    console.log('[1/4] Installing root dependencies...');
    npmInstall(ROOT);
  } else {
    console.log('[1/4] Root dependencies already installed by npm');
  }

  // Step 2: Install client dependencies
  console.log('[2/4] Installing client dependencies...');
  npmInstall(resolve(ROOT, 'client'));

  // Step 3: Build client
  console.log('[3/4] Building client...');
  run('npm run build', resolve(ROOT, 'client'));

  // Step 4: Install Python dependencies
  console.log('[4/4] Installing Python dependencies...');
  const serverDir = resolve(ROOT, 'server');
  run('uv venv', serverDir);
  run('uv sync', serverDir);

  // WhatsApp is now an npm dependency - binary downloaded via postinstall
  console.log('\nBuild complete.');

} catch (err) {
  console.log(`\nBuild failed: ${err.message}`);
  process.exit(1);
}
