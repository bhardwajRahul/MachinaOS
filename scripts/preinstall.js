#!/usr/bin/env node
/**
 * Preinstall cleanup script for MachinaOS.
 *
 * Fixes npm ENOTEMPTY error by cleaning up leftover temp directories
 * that npm fails to remove during failed install/uninstall operations.
 *
 * @see https://github.com/anthropics/claude-code/issues/7373
 * @see https://bobbyhadz.com/blog/npm-err-code-enotempty
 */
import { readdirSync, rmSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Skip in CI
if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
  process.exit(0);
}

function getGlobalNodeModules() {
  try {
    const prefix = execSync('npm config get prefix', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (prefix) {
      return process.platform === 'win32'
        ? resolve(prefix, 'node_modules')
        : resolve(prefix, 'lib', 'node_modules');
    }
  } catch {
    // Ignore
  }
  return null;
}

function cleanup() {
  const nodeModules = getGlobalNodeModules();
  if (!nodeModules) return;

  try {
    const entries = readdirSync(nodeModules);

    // Clean .machinaos-* temp directories
    for (const name of entries) {
      if (name.startsWith('.machinaos-')) {
        const fullPath = resolve(nodeModules, name);
        try {
          if (statSync(fullPath).isDirectory()) {
            rmSync(fullPath, { recursive: true, force: true });
            console.log(`Cleaned: ${name}`);
          }
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Can't read node_modules - that's fine
  }
}

cleanup();
