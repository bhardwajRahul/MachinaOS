#!/usr/bin/env node
/**
 * Cross-platform clean script using Node.js native APIs.
 * Works on: Windows, macOS, Linux, WSL, Git Bash
 */
import { rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const targets = [
  'node_modules',
  'client/node_modules',
  'client/dist',
  'client/.vite',
  'server/whatsapp-rpc/node_modules',
  'server/whatsapp-rpc/bin',
  'server/whatsapp-rpc/data',
  'server/data',
  'server/.venv',
];

console.log('Cleaning...');

for (const target of targets) {
  const fullPath = resolve(ROOT, target);
  if (existsSync(fullPath)) {
    console.log(`  Removing: ${target}`);
    try {
      // Node.js native rmSync - works cross-platform
      rmSync(fullPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (err) {
      console.log(`  Warning: Could not remove ${target}: ${err.message}`);
    }
  }
}

console.log('Done.');
