#!/usr/bin/env node
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load ports from .env
function loadPorts() {
  const envPath = existsSync(resolve(ROOT, '.env')) ? resolve(ROOT, '.env') : resolve(ROOT, '.env.template');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim();
  }
  return {
    frontend: parseInt(env.VITE_CLIENT_PORT),
    backend: parseInt(env.PYTHON_BACKEND_PORT),
    whatsapp: parseInt(env.WHATSAPP_RPC_PORT)
  };
}

const ports = loadPorts();

const SERVICES = [
  { name: 'Frontend', port: ports.frontend },
  { name: 'Python Backend', port: ports.backend, health: '/health' },
  { name: 'WhatsApp RPC', port: ports.whatsapp }
];

const checkHealth = (port, path) => new Promise(resolve => {
  const req = http.get(`http://localhost:${port}${path}`, { timeout: 2000 }, res => resolve(res.statusCode === 200));
  req.on('error', () => resolve(false));
  req.on('timeout', () => { req.destroy(); resolve(false); });
});

const checkPort = port => new Promise(resolve => {
  const req = http.get(`http://localhost:${port}`, { timeout: 1000 }, () => resolve(true));
  req.on('error', () => resolve(false));
  req.on('timeout', () => { req.destroy(); resolve(false); });
});

console.log('Service Status\n' + '='.repeat(60));

for (const svc of SERVICES) {
  const running = await checkPort(svc.port);
  const healthy = svc.health && running ? await checkHealth(svc.port, svc.health) : null;

  let status = running ? 'RUNNING' : 'STOPPED';
  if (healthy === true) status += ' (healthy)';
  if (healthy === false) status += ' (unhealthy)';

  console.log(`${running ? '[OK]' : '[--]'} ${svc.name.padEnd(20)} Port ${svc.port.toString().padEnd(5)} ${status}`);
}

console.log('='.repeat(60));
console.log('\nCommands: npm run start | stop | restart | status');
