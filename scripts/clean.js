#!/usr/bin/env node
/**
 * Cross-platform clean script using Node.js native APIs.
 * Works on: Windows, macOS, Linux, WSL, Git Bash
 *
 * Kills running processes on configured ports before cleaning to avoid
 * locked files (especially .venv on Windows).
 */
import { rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  ROOT,
  loadEnvConfig,
  killPort,
  killMachinaProcesses,
  sleep,
} from './utils.js';

const targets = [
  'node_modules',
  'client/node_modules',
  'client/dist',
  'client/.vite',
  'server/data',
  'server/.venv',
  'server/credentials.db',  // Encrypted credentials database
  '.venv',  // Root venv (stale, should not exist)
];

async function main() {
  console.log('Cleaning MachinaOS...\n');

  // Step 1: Kill processes on configured ports
  const config = loadEnvConfig();
  console.log('Stopping running processes...');

  let killedPorts = 0;
  for (const port of config.allPorts) {
    const result = await killPort(port);
    if (result.killed.length > 0) {
      console.log(`  Port ${port}: Killed ${result.killed.length} process(es)`);
      killedPorts += result.killed.length;
    }
  }

  // Step 2: Kill any remaining MachinaOs processes (orphans holding file locks)
  const orphaned = await killMachinaProcesses('clean.js');
  if (orphaned.length > 0) {
    console.log(`  Orphaned: Killed ${orphaned.length} process(es)`);
  }

  if (killedPorts > 0 || orphaned.length > 0) {
    // Wait for processes to fully terminate and release file handles
    console.log('  Waiting for processes to release file locks...');
    await sleep(1000);
  } else {
    console.log('  No running processes found.');
  }

  // Step 3: Remove directories
  console.log('\nRemoving directories...');

  for (const target of targets) {
    const fullPath = resolve(ROOT, target);
    if (existsSync(fullPath)) {
      console.log(`  Removing: ${target}`);
      try {
        rmSync(fullPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch (err) {
        console.log(`  Warning: Could not remove ${target}: ${err.message}`);
      }
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
