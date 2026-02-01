#!/usr/bin/env node
/**
 * Optional binary download script for MachinaOS.
 * Downloads pre-built WhatsApp RPC server binary from GitHub Releases.
 *
 * Skipped if:
 * - MACHINAOS_SKIP_BINARY_DOWNLOAD=1
 * - CI environment (CI=true)
 * - Go is installed (can build from source)
 *
 * Force download even if Go installed:
 * - MACHINAOS_FORCE_BINARY_DOWNLOAD=1
 */
import { execSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, chmodSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WHATSAPP_BIN_DIR = resolve(ROOT, 'server/whatsapp-rpc/bin');

// Read version from package.json
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
const VERSION = pkg.version;

// GitHub release URL
const GITHUB_REPO = 'trohitg/MachinaOS';
const BASE_URL = `https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}`;

// Platform detection
function getPlatformInfo() {
  const osMap = { 'win32': 'windows', 'darwin': 'darwin', 'linux': 'linux' };
  const archMap = { 'x64': 'amd64', 'arm64': 'arm64' };

  const os = osMap[process.platform];
  const goarch = archMap[process.arch];

  if (!os || !goarch) {
    return null;
  }

  const ext = process.platform === 'win32' ? '.exe' : '';
  return { os, goarch, ext };
}

// Check if Go is installed
function hasGo() {
  try {
    execSync('go version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Download file with redirect handling
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const client = currentUrl.startsWith('https') ? https : require('http');

      client.get(currentUrl, (response) => {
        // Handle redirects (GitHub releases redirect to CDN)
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          request(response.headers.location, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const file = createWriteStream(dest);
        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\r  Downloading: ${percent}%`);
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(' Done');
          resolve();
        });
        file.on('error', (err) => {
          file.close();
          reject(err);
        });
      }).on('error', reject);
    };

    request(url);
  });
}

// Main
async function main() {
  // Skip conditions
  if (process.env.MACHINAOS_SKIP_BINARY_DOWNLOAD === '1') {
    console.log('Skipping binary download (MACHINAOS_SKIP_BINARY_DOWNLOAD=1)');
    return;
  }

  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
    console.log('Skipping binary download (CI environment)');
    return;
  }

  // Check if Go is installed - prefer source build
  if (hasGo()) {
    if (process.env.MACHINAOS_FORCE_BINARY_DOWNLOAD !== '1') {
      console.log('Go is installed - will build from source');
      return;
    }
    console.log('Go is installed but MACHINAOS_FORCE_BINARY_DOWNLOAD=1, downloading anyway');
  }

  const platformInfo = getPlatformInfo();
  if (!platformInfo) {
    console.log(`Unsupported platform: ${process.platform}/${process.arch}`);
    return;
  }

  const { os, goarch, ext } = platformInfo;
  const binaryName = `whatsapp-rpc-server-${os}-${goarch}${ext}`;
  const downloadUrl = `${BASE_URL}/${binaryName}`;
  const destPath = resolve(WHATSAPP_BIN_DIR, `whatsapp-rpc-server${ext}`);

  console.log(`\nDownloading pre-built WhatsApp RPC binary...`);
  console.log(`  Version: v${VERSION}`);
  console.log(`  Platform: ${os}/${goarch}`);

  // Create bin directory
  if (!existsSync(WHATSAPP_BIN_DIR)) {
    mkdirSync(WHATSAPP_BIN_DIR, { recursive: true });
  }

  // Check if binary already exists
  if (existsSync(destPath)) {
    console.log(`  Binary already exists: ${destPath}`);
    return;
  }

  // Download binary
  try {
    await downloadFile(downloadUrl, destPath);
  } catch (error) {
    console.error(`\nFailed to download binary: ${error.message}`);
    console.log('Will attempt to build from source instead.');
    return;
  }

  // Set executable permission (Unix only)
  if (process.platform !== 'win32') {
    chmodSync(destPath, 0o755);
  }

  console.log(`Binary downloaded: ${destPath}`);
}

main().catch((err) => {
  // Don't fail the install - just log and continue
  console.error('Binary download error:', err.message);
});
