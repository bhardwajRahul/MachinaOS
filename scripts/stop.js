#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

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
      // Find PID using netstat and kill with taskkill
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
      return pids.size > 0;
    } else {
      // Unix: use lsof and kill
      const output = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const pids = output.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
        } catch {}
      }
      return pids.length > 0;
    }
  } catch {
    return false;
  }
}

// Kill processes by name
function killProcess(name) {
  try {
    if (isWindows) {
      execSync(`taskkill /IM ${name}.exe /F`, { stdio: 'pipe' });
      return true;
    } else {
      execSync(`pkill -9 ${name}`, { stdio: 'pipe' });
      return true;
    }
  } catch {
    return false;
  }
}

const PORTS = loadPorts();

console.log('Stopping all services...\n');

// Kill by ports
for (const port of PORTS) {
  const killed = killPort(port);
  console.log(`[Port ${port}] ${killed ? 'Killed' : 'Free'}`);
}

// Kill Python/uvicorn
const pythonKilled = killProcess('python') || killProcess('uvicorn');
console.log(`[Python] ${pythonKilled ? 'Killed' : 'Not running'}`);

console.log('\nAll services stopped.');
