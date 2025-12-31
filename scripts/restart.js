#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Set Python UTF-8 encoding to avoid charmap errors on Windows
process.env.PYTHONUTF8 = '1';

console.log('Restarting all services...\n');

console.log('--- Stopping ---');
try { execSync(`node "${join(__dirname, 'stop.js')}"`, { stdio: 'inherit' }); } catch {}

console.log('\nWaiting 2s...\n');
await sleep(2000);

console.log('--- Starting ---');
execSync(`node "${join(__dirname, 'start.js')}"`, { stdio: 'inherit' });
