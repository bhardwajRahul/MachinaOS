#!/usr/bin/env node
/**
 * Build / verify the per-node documentation index.
 *
 * Usage:
 *   node scripts/build-node-docs-index.js          # rewrite README index
 *   node scripts/build-node-docs-index.js --check  # exit 1 if any registry node is undocumented
 *
 * Walks `docs-internal/node-logic-flows/<category>/<node>.md`, scrapes the
 * first H1 of each doc, and rewrites the AUTO-GENERATED-INDEX block in
 * README.md. With --check, also cross-references against
 * `server/nodes/` (the plugin tree, post-Wave-11 source of truth) to
 * catch missing docs after a new plugin lands. Pre-Wave-11 this
 * scraped `client/src/nodeDefinitions/`; that folder is gone.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs-internal', 'node-logic-flows');
const INDEX_FILE = path.join(DOCS_DIR, 'README.md');
// The plugin tree at server/nodes/<category>/<file>.py is the canonical
// list of node types (post-Wave-11). Each plugin class declares
// ``type = "<nodeType>"`` at class scope — we scrape those.
const REGISTRY_GLOB = path.join(ROOT, 'server', 'nodes');

const START_MARKER = '<!-- AUTO-GENERATED-INDEX-START -->';
const END_MARKER = '<!-- AUTO-GENERATED-INDEX-END -->';

function readH1(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : path.basename(filePath, '.md');
}

function listCategories() {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs
    .readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
}

function listDocs(category) {
  const dir = path.join(DOCS_DIR, category);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md')
    .sort()
    .map((f) => ({
      file: f,
      relPath: path.posix.join(category, f),
      title: readH1(path.join(dir, f)),
      nodeKey: path.basename(f, '.md'),
    }));
}

function buildIndexBlock() {
  const cats = listCategories();
  const lines = [START_MARKER];
  for (const cat of cats) {
    const docs = listDocs(cat);
    if (docs.length === 0) continue;
    lines.push('', `### ${cat}`, '');
    for (const doc of docs) {
      lines.push(`- [${doc.title}](./${doc.relPath})`);
    }
  }
  lines.push('', END_MARKER);
  return lines.join('\n');
}

function rewriteIndex() {
  const original = fs.readFileSync(INDEX_FILE, 'utf8');
  const block = buildIndexBlock();
  const re = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`, 'm');
  if (!re.test(original)) {
    console.error(`error: ${INDEX_FILE} is missing the AUTO-GENERATED-INDEX markers`);
    process.exit(2);
  }
  const next = original.replace(re, block);
  fs.writeFileSync(INDEX_FILE, next);
  console.log(`wrote index to ${path.relative(ROOT, INDEX_FILE)}`);
}

function collectDocumentedKeys() {
  const keys = new Set();
  for (const cat of listCategories()) {
    for (const doc of listDocs(cat)) {
      keys.add(doc.nodeKey);
    }
  }
  return keys;
}

function collectRegistryKeys() {
  // Scrape the plugin ``type = "<nodeType>"`` class attribute from every
  // Python file under server/nodes/. Skips ``_*.py`` helpers (``_base``,
  // ``_credentials``, ``_inline``) and ``__init__.py``. Each plugin class
  // declares this once at class scope, so a simple line-anchored regex
  // is enough — no full AST parse.
  const keys = new Set();
  const files = walk(REGISTRY_GLOB).filter(
    (f) =>
      f.endsWith('.py') &&
      !path.basename(f).startsWith('_') &&
      path.basename(f) !== '__init__.py',
  );
  const typeRe = /^\s{4}type\s*(?::\s*str\s*)?=\s*['"]([a-zA-Z_][\w]*)['"]/m;
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const m = text.match(typeRe);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function checkCompleteness() {
  const documented = collectDocumentedKeys();
  const registered = collectRegistryKeys();
  const missing = [...registered].filter((k) => !documented.has(k)).sort();
  if (missing.length === 0) {
    console.log(`OK: every registered node has a logic-flow doc (${registered.size} total)`);
    return 0;
  }
  console.error(`MISSING DOCS for ${missing.length}/${registered.size} nodes:`);
  for (const k of missing) console.error(`  - ${k}`);
  return 1;
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  process.exit(checkCompleteness());
} else {
  rewriteIndex();
}
