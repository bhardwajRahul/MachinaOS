#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync } from 'fs';
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
  'server/whatsapp-rpc/dist',
  'server/whatsapp-rpc/data',
  'server/data',
  'server/.venv',
];

process.chdir(ROOT);
console.log('Cleaning...');

// Detect if running in WSL on Windows filesystem
const isWSL = process.platform === 'linux' && ROOT.startsWith('/mnt/');
const isWindows = process.platform === 'win32';

for (const target of targets) {
  if (existsSync(target)) {
    console.log(`  Removing: ${target}`);
    try {
      if (isWSL) {
        // Use cmd.exe for WSL on /mnt/ - much faster
        const winPath = target.replace(/\//g, '\\\\');
        execSync(`cmd.exe /c "rmdir /s /q ${winPath}"`, { stdio: 'ignore' });
      } else if (isWindows) {
        execSync(`rmdir /s /q "${target}"`, { stdio: 'ignore' });
      } else {
        execSync(`rm -rf "${target}"`, { stdio: 'ignore' });
      }
    } catch {}
  }
}

console.log('Done.');
