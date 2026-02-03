#!/usr/bin/env node
/**
 * Simple static file server for pre-built client.
 * Used in production mode when client dist exists but node_modules doesn't.
 */
import { createServer } from 'http';
import { readFile } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '..', 'client', 'dist');
const PORT = parseInt(process.env.VITE_CLIENT_PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = createServer((req, res) => {
  let url = req.url === '/' ? '/index.html' : req.url;

  // Remove query string
  url = url.split('?')[0];

  const filePath = join(DIST_DIR, url);

  readFile(filePath, (err, content) => {
    if (err) {
      // SPA fallback - serve index.html for routes
      if (err.code === 'ENOENT' && !extname(url)) {
        readFile(join(DIST_DIR, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } else {
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Client: http://localhost:${PORT}`);
});
