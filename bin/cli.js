#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

const COMMANDS = {
  start: 'Start the development server',
  stop: 'Stop all running services',
  build: 'Build the project for production',
  'docker:up': 'Start with Docker Compose',
  'docker:down': 'Stop Docker Compose services',
  'docker:logs': 'View Docker logs',
  init: 'Initialize environment file from template',
  help: 'Show this help message',
};

function printHelp() {
  console.log(`
MachinaOS - Workflow Automation Platform

Usage: machinaos <command>

Commands:
${Object.entries(COMMANDS)
    .map(([cmd, desc]) => `  ${cmd.padEnd(14)} ${desc}`)
    .join('\n')}

Examples:
  machinaos init       # Create .env from template
  machinaos start      # Start development server
  machinaos docker:up  # Start with Docker

Documentation: https://github.com/trohitg/MachinaOS
`);
}

function checkDependencies() {
  const missing = [];

  // Check Node.js version
  const nodeVersion = process.version.slice(1).split('.')[0];
  if (parseInt(nodeVersion) < 18) {
    console.error(`Error: Node.js 18+ required (found ${process.version})`);
    process.exit(1);
  }

  // Check Python
  try {
    execSync('python --version', { stdio: 'pipe' });
  } catch {
    missing.push('Python 3.11+');
  }

  // Check uv (Python package manager)
  try {
    execSync('uv --version', { stdio: 'pipe' });
  } catch {
    missing.push('uv (install: curl -LsSf https://astral.sh/uv/install.sh | sh)');
  }

  if (missing.length > 0) {
    console.error('Missing dependencies:');
    missing.forEach((dep) => console.error(`  - ${dep}`));
    console.error('\nPlease install the missing dependencies and try again.');
    process.exit(1);
  }
}

function initEnv() {
  const envPath = resolve(ROOT_DIR, 'server', '.env');
  const templatePath = resolve(ROOT_DIR, '.env.template');

  if (existsSync(envPath)) {
    console.log('.env file already exists at server/.env');
    return;
  }

  if (!existsSync(templatePath)) {
    console.error('Error: .env.template not found');
    process.exit(1);
  }

  copyFileSync(templatePath, envPath);
  console.log('Created server/.env from template');
  console.log('Edit server/.env to configure your API keys and settings');
}

function runNpmScript(script) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npm, ['run', script], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error(`Failed to run: ${err.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code || 0);
  });
}

// Main
const [, , command = 'help'] = process.argv;

switch (command) {
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;

  case 'init':
    initEnv();
    break;

  case 'start':
    checkDependencies();
    if (!existsSync(resolve(ROOT_DIR, 'server', '.env'))) {
      console.log('No .env found. Running init first...');
      initEnv();
    }
    runNpmScript('start');
    break;

  case 'stop':
    runNpmScript('stop');
    break;

  case 'build':
    runNpmScript('build');
    break;

  case 'docker:up':
    runNpmScript('docker:up');
    break;

  case 'docker:down':
    runNpmScript('docker:down');
    break;

  case 'docker:logs':
    runNpmScript('docker:logs');
    break;

  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
