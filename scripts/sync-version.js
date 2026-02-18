#!/usr/bin/env node
/**
 * Syncs package.json version from the latest git tag.
 *
 * Usage:
 *   node scripts/sync-version.js          # Sync from latest tag
 *   node scripts/sync-version.js v0.0.11  # Sync from specific tag
 *
 * This script:
 * 1. Gets the latest git tag (or uses provided tag)
 * 2. Strips the 'v' prefix to get semver version
 * 3. Updates root package.json and client/package.json
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function getLatestTag() {
  try {
    // Get the latest tag sorted by version
    const tag = execSync('git describe --tags --abbrev=0', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: ROOT
    }).trim();
    return tag;
  } catch {
    // Fallback: list tags and get the latest by version sort
    try {
      const tags = execSync('git tag -l --sort=-version:refname', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: ROOT
      }).trim().split('\n');
      return tags[0] || null;
    } catch {
      return null;
    }
  }
}

function tagToVersion(tag) {
  // Strip 'v' prefix if present: v0.0.11 -> 0.0.11
  return tag.replace(/^v/, '');
}

function updatePackageJson(filePath, newVersion) {
  const content = readFileSync(filePath, 'utf-8');
  const pkg = JSON.parse(content);
  const oldVersion = pkg.version;

  if (oldVersion === newVersion) {
    console.log(`  ${filePath}: already at ${newVersion}`);
    return false;
  }

  pkg.version = newVersion;
  // Preserve formatting (2-space indent)
  writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ${filePath}: ${oldVersion} -> ${newVersion}`);
  return true;
}

// Main
const providedTag = process.argv[2];
const tag = providedTag || getLatestTag();

if (!tag) {
  console.error('Error: No git tags found and no tag provided.');
  console.error('Usage: node scripts/sync-version.js [tag]');
  process.exit(1);
}

const version = tagToVersion(tag);

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Error: Invalid version format from tag "${tag}": "${version}"`);
  console.error('Expected semver format like v0.0.11 or 0.0.11');
  process.exit(1);
}

console.log(`Syncing version from tag: ${tag} -> ${version}\n`);

const packageFiles = [
  resolve(ROOT, 'package.json'),
  resolve(ROOT, 'client', 'package.json'),
];

let updated = 0;
for (const file of packageFiles) {
  try {
    if (updatePackageJson(file, version)) {
      updated++;
    }
  } catch (err) {
    console.error(`  Error updating ${file}: ${err.message}`);
  }
}

if (updated > 0) {
  console.log(`\nUpdated ${updated} file(s). Don't forget to commit the changes.`);
} else {
  console.log('\nAll package.json files already at correct version.');
}
