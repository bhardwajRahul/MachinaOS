#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

const COMMANDS = {
  start: 'Start the development server',
  stop: 'Stop all running services',
  build: 'Build the project for production',
  clean: 'Clean build artifacts',
  'docker:up': 'Start with Docker Compose',
  'docker:down': 'Stop Docker Compose services',
  'docker:build': 'Build Docker images',
  'docker:logs': 'View Docker logs',
  help: 'Show this help message',
  version: 'Show version number',
};

function printHelp() {
  console.log(`
MachinaOS - Workflow Automation Platform

Usage: machinaos <command>

Commands:
${Object.entries(COMMANDS).map(([cmd, desc]) => `  ${cmd.padEnd(14)} ${desc}`).join('\n')}

Examples:
  machinaos start      # Start development server
  machinaos build      # Build for production
  machinaos docker:up  # Start with Docker

Documentation: https://github.com/trohitg/MachinaOS
`);
}

function getVersion(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

// Add common binary paths to PATH (Linux installs uv to ~/.local/bin)
function expandPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    const additionalPaths = [
      `${home}/.local/bin`,      // uv, cargo installs
      `${home}/.cargo/bin`,      // Rust tools
      '/usr/local/bin',          // Homebrew on macOS
    ];
    const currentPath = process.env.PATH || '';
    const sep = process.platform === 'win32' ? ';' : ':';
    const newPaths = additionalPaths.filter(p => !currentPath.includes(p));
    if (newPaths.length > 0) {
      process.env.PATH = newPaths.join(sep) + sep + currentPath;
    }
  }
}

function checkDeps() {
  const errors = [];

  // Node.js version check
  const nodeVersion = parseInt(process.version.slice(1));
  if (nodeVersion < 22) {
    errors.push(`Node.js 22+ required (found ${process.version})`);
  }

  // Python version check
  let pyVersion = getVersion('python --version') || getVersion('python3 --version');
  if (!pyVersion) {
    errors.push('Python 3.12+ - https://python.org/');
  } else {
    const match = pyVersion.match(/Python (\d+)\.(\d+)/);
    if (match) {
      const [, major, minor] = match.map(Number);
      if (major < 3 || (major === 3 && minor < 12)) {
        errors.push(`Python 3.12+ required (found ${pyVersion})`);
      }
    }
  }

  // uv package manager check
  if (!getVersion('uv --version')) {
    errors.push('uv (Python package manager) - https://docs.astral.sh/uv/');
  }

  if (errors.length > 0) {
    console.error('Missing required dependencies:\n' + errors.map(e => `  - ${e}`).join('\n'));
    console.error('\nInstall the missing dependencies and try again.');
    process.exit(1);
  }
}

function run(script) {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  child.on('error', (e) => { console.error(`Failed: ${e.message}`); process.exit(1); });
  child.on('close', (code) => process.exit(code || 0));
}

// Expand PATH to find tools like uv installed in user directories
expandPath();

const cmd = process.argv[2] || 'help';

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  printHelp();
} else if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
  console.log(`machinaos v${PKG.version}`);
} else if (cmd === 'start' || cmd === 'build') {
  checkDeps();
  run(cmd);
} else if (COMMANDS[cmd]) {
  run(cmd);
} else {
  console.error(`Unknown command: ${cmd}`);
  printHelp();
  process.exit(1);
}
