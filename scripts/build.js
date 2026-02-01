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

// Skip build entirely in CI (workflows handle this)
if (isCI && isPostInstall) {
  console.log('CI environment detected, skipping postinstall build.');
  process.exit(0);
}


// Ensure Python UTF-8 encoding
process.env.PYTHONUTF8 = '1';

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
    return execSync(cmd, { encoding: 'utf-8', shell: true }).trim();
  } catch {
    return null;
  }
}

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function npmInstall(cwd = ROOT) {
  // Use npm install directly with visible output
  // npm ci requires package-lock.json which may not exist in all directories
  execSync('npm install', { cwd, stdio: 'inherit', shell: true });
}

// ============================================================================
// Auto-install missing dependencies
// ============================================================================

function installPython() {
  console.log('  Installing Python 3.11+...');
  if (isWindows) {
    // Try winget first, then choco
    if (runSilent('winget --version')) {
      run('winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements');
    } else if (runSilent('choco --version')) {
      run('choco install python312 -y');
    } else {
      console.error('  Error: Please install Python manually from https://python.org/');
      console.error('  Or install winget/chocolatey first.');
      process.exit(1);
    }
  } else if (isMac) {
    if (runSilent('brew --version')) {
      run('brew install python@3.12');
    } else {
      console.error('  Error: Please install Homebrew first: https://brew.sh/');
      process.exit(1);
    }
  } else {
    // Linux
    if (runSilent('apt --version')) {
      run('sudo apt update && sudo apt install -y python3.12 python3.12-venv');
    } else if (runSilent('dnf --version')) {
      run('sudo dnf install -y python3.12');
    } else if (runSilent('pacman --version')) {
      run('sudo pacman -S --noconfirm python');
    } else {
      console.error('  Error: Please install Python manually from https://python.org/');
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
  // Add to PATH for current session
  if (isWindows) {
    process.env.PATH = `${process.env.USERPROFILE}\\.local\\bin;${process.env.PATH}`;
  } else {
    process.env.PATH = `${process.env.HOME}/.local/bin:${process.env.PATH}`;
  }
}

function installGo() {
  console.log('  Installing Go...');
  if (isWindows) {
    if (runSilent('winget --version')) {
      run('winget install GoLang.Go --accept-package-agreements --accept-source-agreements');
    } else if (runSilent('choco --version')) {
      run('choco install golang -y');
    } else {
      console.error('  Error: Please install Go manually from https://go.dev/dl/');
      process.exit(1);
    }
  } else if (isMac) {
    if (runSilent('brew --version')) {
      run('brew install go');
    } else {
      console.error('  Error: Please install Homebrew first: https://brew.sh/');
      process.exit(1);
    }
  } else {
    if (runSilent('apt --version')) {
      run('sudo apt update && sudo apt install -y golang-go');
    } else if (runSilent('dnf --version')) {
      run('sudo dnf install -y golang');
    } else if (runSilent('pacman --version')) {
      run('sudo pacman -S --noconfirm go');
    } else {
      console.error('  Error: Please install Go manually from https://go.dev/dl/');
      process.exit(1);
    }
  }
}

// ============================================================================
// Check and Install Dependencies
// ============================================================================

console.log('Checking dependencies...\n');

// Node.js (must already be installed to run this script)
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
  // Re-check
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
    console.error('  Error: Failed to install uv. Please install manually.');
    console.error('  https://docs.astral.sh/uv/getting-started/installation/');
    process.exit(1);
  }
}

// Go
let goVersionFull = getVersion('go version');
if (goVersionFull) {
  const goVersion = goVersionFull.match(/go\d+\.\d+(\.\d+)?/)?.[0] || 'go';
  console.log(`  Go: ${goVersion}`);
} else {
  installGo();
  goVersionFull = getVersion('go version');
  if (goVersionFull) {
    const goVersion = goVersionFull.match(/go\d+\.\d+(\.\d+)?/)?.[0] || 'go';
    console.log(`  Go: ${goVersion}`);
  } else {
    console.error('  Error: Failed to install Go. Please install manually.');
    console.error('  https://go.dev/dl/');
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
    log('0/5', 'Created .env from template');
  }

  // Step 1: Install root dependencies (skip if postinstall - npm already did this)
  if (!isPostInstall) {
    log('1/6', 'Installing root dependencies...');
    npmInstall(ROOT);
  } else {
    log('1/6', 'Root dependencies already installed by npm');
  }

  // Step 2: Install client dependencies
  log('2/6', 'Installing client dependencies...');
  npmInstall(resolve(ROOT, 'client'));

  // Step 3: Build client
  log('3/6', 'Building client...');
  run('npm run build', resolve(ROOT, 'client'));

  // Step 4: Install Python dependencies
  log('4/6', 'Installing Python dependencies...');
  const serverDir = resolve(ROOT, 'server');
  run('uv venv', serverDir);
  run('uv sync', serverDir);

  // Step 5: Install WhatsApp dependencies
  log('5/6', 'Installing WhatsApp dependencies...');
  const whatsappDir = resolve(ROOT, 'server/whatsapp-rpc');
  npmInstall(whatsappDir);

  // Step 6: Build WhatsApp server (Go binary)
  log('6/6', 'Building WhatsApp server...');
  run('npm run build', whatsappDir);

  console.log('\nBuild complete.');

} catch (err) {
  console.error('\nBuild failed:', err.message);
  process.exit(1);
}
