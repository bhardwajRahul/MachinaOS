#!/usr/bin/env node
/**
 * Docker compose wrapper that auto-enables Redis profile based on REDIS_ENABLED in .env
 * Usage: node scripts/docker.js <command> [args...]
 * Commands: up, down, build, logs, restart
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Create .env from template if it doesn't exist
function ensureEnvFile() {
  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) return true;

  const templatePath = resolve(ROOT, '.env.template');
  if (existsSync(templatePath)) {
    console.log('[Docker] Creating .env from .env.template');
    copyFileSync(templatePath, envPath);
    return true;
  }

  console.warn('[Docker] Warning: No .env or .env.template found');
  return false;
}

// Read .env file and check REDIS_ENABLED
function isRedisEnabled() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return false;

  const content = readFileSync(envPath, 'utf8');
  const match = content.match(/^REDIS_ENABLED\s*=\s*(.+)$/m);
  if (!match) return false;

  const value = match[1].trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

// Get command and args
const [,, command, ...args] = process.argv;

if (!command) {
  console.error('Usage: node scripts/docker.js <command> [args...]');
  console.error('Commands: up, down, build, logs, restart');
  process.exit(1);
}

// Ensure .env exists (create from template if needed)
ensureEnvFile();

// Build docker-compose command
const composeArgs = [];

// Add Redis profile if enabled in .env
if (isRedisEnabled()) {
  composeArgs.push('--profile', 'redis');
  console.log('[Docker] Redis profile enabled (REDIS_ENABLED=true in .env)');
} else {
  console.log('[Docker] Redis profile disabled (REDIS_ENABLED=false in .env)');
}

// Add command
composeArgs.push(command);

// Add command-specific defaults
if (command === 'up') {
  composeArgs.push('-d'); // detached by default
}
if (command === 'logs') {
  composeArgs.push('-f'); // follow by default
}

// Add any additional args
composeArgs.push(...args);

console.log(`[Docker] Running: docker-compose ${composeArgs.join(' ')}`);

// Run docker-compose
const proc = spawn('docker-compose', composeArgs, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});
