import { rm } from 'fs/promises';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const dirsToRemove = [
  'node_modules',
  'client/node_modules',
  'client/dist',
  'client/.vite',
  'server/whatsapp-rpc/node_modules',
  'server/whatsapp-rpc/dist',
  'server/data',
  '.eslintcache'
];

const filesToRemove = [
  '.env'
];

const filePatternsToRemove = [
  '.db',
  '.sqlite',
  '.sqlite3'
];

// Find all __pycache__ directories and db files recursively
function findCleanTargets(dir, dirs = [], files = []) {
  if (!existsSync(dir)) return { dirs, files };

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          if (entry === '__pycache__' || entry === '.pytest_cache') {
            dirs.push(fullPath);
          } else if (entry !== 'node_modules' && entry !== '.git') {
            findCleanTargets(fullPath, dirs, files);
          }
        } else if (stat.isFile()) {
          if (filePatternsToRemove.some(ext => entry.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch {}
    }
  } catch {}

  return { dirs, files };
}

async function clean() {
  const serverTargets = findCleanTargets('server');
  const rootTargets = findCleanTargets('.');

  const allDirs = [...dirsToRemove, ...serverTargets.dirs];
  const allFiles = [...filesToRemove, ...serverTargets.files, ...rootTargets.files.filter(f => !f.includes('node_modules'))];

  console.log('Cleaning build artifacts...');

  for (const dir of allDirs) {
    if (existsSync(dir)) {
      try {
        await rm(dir, { recursive: true, force: true });
        console.log(`  Removed dir: ${dir}`);
      } catch (err) {
        console.error(`  Failed to remove ${dir}: ${err.message}`);
      }
    }
  }

  for (const file of allFiles) {
    if (existsSync(file)) {
      try {
        await rm(file, { force: true });
        console.log(`  Removed file: ${file}`);
      } catch (err) {
        console.error(`  Failed to remove ${file}: ${err.message}`);
      }
    }
  }

  console.log('Done.');
}

clean();
