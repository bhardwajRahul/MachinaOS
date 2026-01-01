#!/usr/bin/env node
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync, copyFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const START = Date.now();
const isWindows = process.platform === 'win32';

// Timing helper
const elapsed = () => `${((Date.now() - START) / 1000).toFixed(2)}s`;
const log = (msg) => console.log(`[${elapsed()}] ${msg}`);

// Load ports from .env
function loadPorts() {
  const envPath = existsSync(resolve(ROOT, '.env')) ? resolve(ROOT, '.env') : resolve(ROOT, '.env.template');
  if (!existsSync(envPath)) return [3000, 3010, 9400];
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim();
  }
  return [
    parseInt(env.VITE_CLIENT_PORT) || 3000,
    parseInt(env.PYTHON_BACKEND_PORT) || 3010,
    parseInt(env.WHATSAPP_RPC_PORT) || 9400
  ];
}

// Kill process by port using native commands
function killPort(port) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid))) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
        } catch {}
      }
    } else {
      const output = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const pids = output.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
        } catch {}
      }
    }
  } catch {}
}

const PORTS = loadPorts();
process.env.PYTHONUTF8 = '1';

console.log('\n=== MachinaOS Starting ===\n');

// Step 1: Create .env if not exists
const envPath = resolve(ROOT, '.env');
const templatePath = resolve(ROOT, '.env.template');
if (!existsSync(envPath) && existsSync(templatePath)) {
  copyFileSync(templatePath, envPath);
  log('Created .env from template');
}

// Step 2: Free ports
log('Freeing ports...');
for (const port of PORTS) {
  killPort(port);
}
log('Ports ready');

// Step 3: Start dev server
log('Starting services...');
spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: 'inherit', shell: true });
