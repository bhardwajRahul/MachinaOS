#!/usr/bin/env node
/**
 * Cross-platform service installer for MachinaOS.
 * Works on: Windows (NSSM), Linux (systemd), macOS (launchd)
 *
 * Usage:
 *   node scripts/service.js install [OPTIONS]
 *   node scripts/service.js uninstall
 *   node scripts/service.js status
 *   node scripts/service.js start
 *   node scripts/service.js stop
 *   node scripts/service.js restart
 *
 * Options:
 *   --dir=PATH       Installation directory (default: current directory)
 *   --user=USER      Service user (default: current user)
 *   --memory=LIMIT   Memory limit (default: 2G, Linux only)
 */
import { execSync, spawnSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Platform detection
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// Service name
const SERVICE_NAME = 'MachinaOs';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'help';
const options = {};
args.slice(1).forEach(arg => {
  const match = arg.match(/^--(\w+)=(.+)$/);
  if (match) {
    options[match[1]] = match[2];
  }
});

// Default options
const installDir = options.dir || ROOT;
const serviceUser = options.user || (isWindows ? process.env.USERNAME : process.env.USER);
const memoryLimit = options.memory || '2G';

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: opts.silent ? 'pipe' : 'inherit',
      shell: true,
      ...opts
    });
  } catch (e) {
    if (!opts.ignoreError) {
      throw e;
    }
    return '';
  }
}

function runSilent(cmd) {
  try {
    execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', shell: true });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Windows (NSSM)
// ============================================================================

function windowsCheckNssm() {
  if (!runSilent('where nssm')) {
    console.log('NSSM not found. Install from https://nssm.cc/');
    console.log('Or use: winget install nssm');
    process.exit(1);
  }
}

function windowsInstall() {
  windowsCheckNssm();

  const pythonExe = resolve(installDir, 'server', '.venv', 'Scripts', 'python.exe');
  const serverDir = resolve(installDir, 'server');
  const logsDir = resolve(installDir, 'logs');

  if (!existsSync(pythonExe)) {
    console.log(`Python venv not found at ${pythonExe}`);
    console.log('Run "npm run build" first.');
    process.exit(1);
  }

  // Create logs directory
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  console.log(`Installing ${SERVICE_NAME} service...`);
  console.log(`  Directory: ${installDir}`);
  console.log(`  Python: ${pythonExe}`);

  // Remove existing service if present
  run(`nssm stop ${SERVICE_NAME}`, { ignoreError: true, silent: true });
  run(`nssm remove ${SERVICE_NAME} confirm`, { ignoreError: true, silent: true });

  // Install service
  run(`nssm install ${SERVICE_NAME} "${pythonExe}" -m gunicorn main:app -c gunicorn.conf.py`);
  run(`nssm set ${SERVICE_NAME} AppDirectory "${serverDir}"`);
  run(`nssm set ${SERVICE_NAME} AppEnvironmentExtra "PYTHONPATH=${serverDir}"`);
  run(`nssm set ${SERVICE_NAME} Start SERVICE_AUTO_START`);
  run(`nssm set ${SERVICE_NAME} AppStdout "${logsDir}\\service.log"`);
  run(`nssm set ${SERVICE_NAME} AppStderr "${logsDir}\\service.log"`);
  run(`nssm set ${SERVICE_NAME} AppRotateFiles 1`);
  run(`nssm set ${SERVICE_NAME} AppRotateBytes 10485760`); // 10MB

  console.log('Service installed successfully.');
  console.log(`Logs: ${logsDir}\\service.log`);
}

function windowsUninstall() {
  windowsCheckNssm();
  run(`nssm stop ${SERVICE_NAME}`, { ignoreError: true });
  run(`nssm remove ${SERVICE_NAME} confirm`, { ignoreError: true });
  console.log('Service uninstalled.');
}

function windowsStatus() {
  windowsCheckNssm();
  run(`nssm status ${SERVICE_NAME}`, { ignoreError: true });
}

function windowsStart() {
  windowsCheckNssm();
  run(`nssm start ${SERVICE_NAME}`);
}

function windowsStop() {
  windowsCheckNssm();
  run(`nssm stop ${SERVICE_NAME}`);
}

function windowsRestart() {
  windowsCheckNssm();
  run(`nssm restart ${SERVICE_NAME}`);
}

// ============================================================================
// Linux (systemd)
// ============================================================================

function linuxGenerateServiceFile() {
  const venvPath = resolve(installDir, 'server', '.venv');
  const serverDir = resolve(installDir, 'server');

  return `[Unit]
Description=MachinaOs Backend
After=network.target

[Service]
Type=simple
User=${serviceUser}
WorkingDirectory=${serverDir}
EnvironmentFile=${installDir}/.env
ExecStart=${venvPath}/bin/gunicorn main:app -c gunicorn.conf.py
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

# Resource limits
MemoryMax=${memoryLimit}

[Install]
WantedBy=multi-user.target
`;
}

function linuxInstall() {
  const venvPath = resolve(installDir, 'server', '.venv', 'bin', 'python');

  if (!existsSync(venvPath)) {
    console.log(`Python venv not found at ${venvPath}`);
    console.log('Run "npm run build" first.');
    process.exit(1);
  }

  console.log(`Installing ${SERVICE_NAME} service...`);
  console.log(`  Directory: ${installDir}`);
  console.log(`  User: ${serviceUser}`);
  console.log(`  Memory limit: ${memoryLimit}`);

  const serviceContent = linuxGenerateServiceFile();
  const tempFile = '/tmp/machina.service';
  writeFileSync(tempFile, serviceContent);

  run(`sudo cp ${tempFile} /etc/systemd/system/machina.service`);
  run('sudo systemctl daemon-reload');
  run('sudo systemctl enable machina');

  console.log('Service installed successfully.');
  console.log('Start with: sudo systemctl start machina');
  console.log('View logs: journalctl -u machina -f');
}

function linuxUninstall() {
  run('sudo systemctl stop machina', { ignoreError: true });
  run('sudo systemctl disable machina', { ignoreError: true });
  if (existsSync('/etc/systemd/system/machina.service')) {
    run('sudo rm /etc/systemd/system/machina.service');
  }
  run('sudo systemctl daemon-reload');
  console.log('Service uninstalled.');
}

function linuxStatus() {
  run('systemctl status machina', { ignoreError: true });
}

function linuxStart() {
  run('sudo systemctl start machina');
}

function linuxStop() {
  run('sudo systemctl stop machina');
}

function linuxRestart() {
  run('sudo systemctl restart machina');
}

// ============================================================================
// macOS (launchd)
// ============================================================================

function macGeneratePlist() {
  const venvPath = resolve(installDir, 'server', '.venv');
  const serverDir = resolve(installDir, 'server');
  const logsDir = resolve(installDir, 'logs');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.machinaos.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>${venvPath}/bin/gunicorn</string>
        <string>main:app</string>
        <string>-c</string>
        <string>gunicorn.conf.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${serverDir}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${venvPath}/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${logsDir}/service.log</string>
    <key>StandardErrorPath</key>
    <string>${logsDir}/service.log</string>
</dict>
</plist>
`;
}

function macGetPlistPath() {
  return resolve(homedir(), 'Library', 'LaunchAgents', 'com.machinaos.backend.plist');
}

function macInstall() {
  const venvPath = resolve(installDir, 'server', '.venv', 'bin', 'python');
  const logsDir = resolve(installDir, 'logs');

  if (!existsSync(venvPath)) {
    console.log(`Python venv not found at ${venvPath}`);
    console.log('Run "npm run build" first.');
    process.exit(1);
  }

  // Create logs directory
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  console.log(`Installing ${SERVICE_NAME} service...`);
  console.log(`  Directory: ${installDir}`);

  const plistContent = macGeneratePlist();
  const plistPath = macGetPlistPath();

  // Ensure LaunchAgents directory exists
  const launchAgentsDir = dirname(plistPath);
  if (!existsSync(launchAgentsDir)) {
    mkdirSync(launchAgentsDir, { recursive: true });
  }

  // Unload existing if present
  run(`launchctl unload "${plistPath}"`, { ignoreError: true, silent: true });

  writeFileSync(plistPath, plistContent);

  console.log('Service installed successfully.');
  console.log(`Plist: ${plistPath}`);
  console.log(`Logs: ${logsDir}/service.log`);
  console.log('Start with: node scripts/service.js start');
}

function macUninstall() {
  const plistPath = macGetPlistPath();
  run(`launchctl unload "${plistPath}"`, { ignoreError: true });
  if (existsSync(plistPath)) {
    unlinkSync(plistPath);
  }
  console.log('Service uninstalled.');
}

function macStatus() {
  run('launchctl list | grep machinaos', { ignoreError: true });
}

function macStart() {
  const plistPath = macGetPlistPath();
  run(`launchctl load "${plistPath}"`);
}

function macStop() {
  const plistPath = macGetPlistPath();
  run(`launchctl unload "${plistPath}"`);
}

function macRestart() {
  macStop();
  macStart();
}

// ============================================================================
// Main
// ============================================================================

function showHelp() {
  console.log(`
MachinaOS Service Manager

Usage: node scripts/service.js <command> [options]

Commands:
  install     Install as system service
  uninstall   Remove system service
  status      Show service status
  start       Start the service
  stop        Stop the service
  restart     Restart the service

Options:
  --dir=PATH      Installation directory (default: current)
  --user=USER     Service user (Linux only, default: current user)
  --memory=LIMIT  Memory limit (Linux only, default: 2G)

Platform: ${isWindows ? 'Windows (NSSM)' : isMac ? 'macOS (launchd)' : 'Linux (systemd)'}

Examples:
  node scripts/service.js install
  node scripts/service.js install --dir=/opt/machinaos --user=machina
  node scripts/service.js status
  node scripts/service.js restart
`);
}

// Dispatch to platform-specific functions
const handlers = {
  windows: {
    install: windowsInstall,
    uninstall: windowsUninstall,
    status: windowsStatus,
    start: windowsStart,
    stop: windowsStop,
    restart: windowsRestart,
  },
  linux: {
    install: linuxInstall,
    uninstall: linuxUninstall,
    status: linuxStatus,
    start: linuxStart,
    stop: linuxStop,
    restart: linuxRestart,
  },
  mac: {
    install: macInstall,
    uninstall: macUninstall,
    status: macStatus,
    start: macStart,
    stop: macStop,
    restart: macRestart,
  },
};

const platform = isWindows ? 'windows' : isMac ? 'mac' : 'linux';

if (command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

const handler = handlers[platform][command];
if (!handler) {
  console.log(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}

handler();
