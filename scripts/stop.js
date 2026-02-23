#!/usr/bin/env node
/**
 * Cross-platform stop script for MachinaOS services.
 * Works on: Windows, macOS, Linux, WSL, Git Bash
 */
import {
  getPlatformName,
  loadEnvConfig,
  killPort,
  killByPattern,
  killOrphanedProcesses,
  sleep,
} from './utils.js';

async function main() {
  const config = loadEnvConfig();

  console.log('Stopping MachinaOS services...\n');
  console.log(`Platform: ${getPlatformName()}`);
  console.log(`Ports: ${config.allPorts.join(', ')}`);
  console.log(`Temporal: ${config.temporalEnabled ? 'enabled' : 'disabled'}\n`);

  let allStopped = true;

  for (const port of config.allPorts) {
    const result = await killPort(port);
    const status = result.portFree ? '[OK]' : '[!!]';
    const message = result.portFree
      ? (result.killed.length > 0 ? `Killed ${result.killed.length} process(es)` : 'Free')
      : 'Warning: Port still in use';

    console.log(`${status} Port ${port}: ${message}`);
    if (result.killed.length > 0) {
      console.log(`    PIDs: ${result.killed.join(', ')}`);
    }
    if (!result.portFree) allStopped = false;
  }

  if (config.temporalEnabled) {
    const temporalPids = await killByPattern('temporal');
    if (temporalPids.length > 0) {
      console.log(`[OK] Temporal: Killed ${temporalPids.length} process(es)`);
    }
  }

  // Kill orphaned MachinaOs processes (may hold DB locks after crash)
  const orphanedPids = await killOrphanedProcesses();
  if (orphanedPids.length > 0) {
    await sleep(200);
    console.log(`[OK] Orphaned: Killed ${orphanedPids.length} MachinaOs process(es)`);
    console.log(`    PIDs: ${orphanedPids.join(', ')}`);
  }

  console.log('');
  if (allStopped) {
    console.log('All services stopped.');
  } else {
    console.log('Warning: Some ports may still be in use.');
    process.exit(1);
  }
}

main().catch(console.error);
