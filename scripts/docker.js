#!/usr/bin/env node
/**
 * Docker compose wrapper that auto-enables Redis profile based on REDIS_ENABLED in .env
 * Usage: node scripts/docker.js <command> [args...]
 * Commands: up, down, build, logs, restart
 */
import { spawn, execSync } from 'child_process';
import {
  ROOT,
  loadEnvConfig,
  ensureEnvFile,
} from './utils.js';

// Get command and args
const [,, command, ...args] = process.argv;

if (!command) {
  console.error('Usage: node scripts/docker.js <command> [args...]');
  console.error('Commands: up, down, build, logs, restart');
  process.exit(1);
}

// Ensure .env exists (create from template if needed)
if (ensureEnvFile()) {
  console.log('[Docker] Ensured .env file exists');
}

// Load config
const config = loadEnvConfig();

// Build docker-compose command
const composeArgs = [];

// Add Redis profile if enabled in .env
if (config.redisEnabled) {
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

// Detect docker compose v2 (docker compose) vs v1 (docker-compose)
let useV2 = false;
try {
  execSync('docker compose version', { stdio: 'pipe', timeout: 5000 });
  useV2 = true;
} catch {
  // Fall back to docker-compose v1
}

const composeCmd = useV2 ? 'docker' : 'docker-compose';
const composeFinalArgs = useV2 ? ['compose', ...composeArgs] : composeArgs;

console.log(`[Docker] Running: ${composeCmd} ${composeFinalArgs.join(' ')}`);

const proc = spawn(composeCmd, composeFinalArgs, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});
