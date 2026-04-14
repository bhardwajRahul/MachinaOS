/**
 * Wave 10.B: schema-driven icon resolver — n8n-aligned prefix scheme.
 *
 * Backend plugins declare an icon string; the resolver picks the
 * right source based on the prefix (same `file:` / `fa:` / URL
 * pattern n8n uses, extended for React icon libraries):
 *
 *   `asset:<key>`       → filesystem SVG (Vite `import.meta.glob`
 *                         over `client/src/assets/icons/**\/*.svg`).
 *                         Key is the filename minus `.svg`. Dropping
 *                         a `<key>.svg` into any subfolder registers
 *                         it automatically — no central edit.
 *   `<lib>:<brand>`     → React component from an installed NPM icon
 *                         library. `<lib>` names the package
 *                         (`lobehub` today; add more in
 *                         `ICON_LIBRARIES` below). `<brand>` is a
 *                         case-insensitive lookup. `.Color` variant
 *                         preferred, `.Avatar` fallback.
 *   `data:...`          → data-URI passthrough (inline SVG / base64).
 *   `http(s)://...`     → remote URL passthrough.
 *   `/...`              → absolute local URL passthrough.
 *   plain text          → emoji / short label (rendered as-is).
 *
 * Consumers call `resolveLibraryIcon` first for React component
 * icons, then `resolveIcon` for strings / image URIs. No node-type
 * knowledge anywhere in the frontend.
 */

import * as React from 'react';
import * as Lobehub from '@lobehub/icons';

type RawSvg = string;

// Eagerly load every .svg file as its raw string contents so the
// resolver is synchronous at render time.
const svgModules = import.meta.glob<RawSvg>('./**/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
};

const keyFromPath = (path: string): string => {
  // './google/gmail.svg' -> 'gmail'
  const filename = path.split('/').pop() ?? '';
  return filename.replace(/\.svg$/i, '');
};

const entries = Object.entries(svgModules)
  .sort(([a], [b]) => a.localeCompare(b)) // deterministic on collisions
  .map(([path, raw]) => [keyFromPath(path), svgToDataUri(raw as string)] as const);

/** Filesystem-derived asset key -> SVG data URI. */
export const ICON_REGISTRY: Readonly<Record<string, string>> = Object.fromEntries(entries);

/**
 * Resolve a backend-declared icon string to something renderable.
 * Contract:
 *   `asset:<key>` → look up in ICON_REGISTRY (filesystem-derived)
 *   `data:...`    → pass through
 *   otherwise     → render as-is (emoji / short text / URL)
 * Returns `null` when the icon string is empty or an unknown asset key,
 * so callers can apply their own fallback.
 */
export const resolveIcon = (icon: string | undefined | null): string | null => {
  if (!icon) return null;
  if (icon.startsWith('asset:')) {
    // Unknown asset key — backend declared a file that doesn't exist in
    // client/src/assets/icons/. Return null so the gap is visible to
    // the author rather than masked by a fallback emoji.
    return ICON_REGISTRY[icon.slice('asset:'.length)] ?? null;
  }
  if (icon.startsWith('data:') || icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/')) {
    return icon;
  }
  // Library-prefixed strings are handled by `resolveLibraryIcon`; if
  // they reach here it means the caller only consulted `resolveIcon`
  // and should also try the library resolver — treat as unresolvable.
  if (icon.includes(':')) return null;
  return icon; // plain emoji / short text — callers render as <span>
};

/** True when the resolved icon is an image URI (data: or http: or /path). */
export const isImageIcon = (resolved: string): boolean =>
  resolved.startsWith('data:') || resolved.startsWith('http') || resolved.startsWith('/');

/**
 * Library-icon resolver. Dispatches `<lib>:<brand>` strings to the
 * matching NPM icon package. Adding a new library is one entry in
 * `ICON_LIBRARIES` — no per-brand hardcoding, names come from the
 * package's own exports.
 */
export type LibraryIcon = React.FC<{ size?: number }>;

type LibraryResolver = (brand: string) => LibraryIcon | null;

// Build a case-insensitive name index once per library so `lobehub:claude`
// and `lobehub:Claude` both hit the same `Claude` export.
const indexLibrary = (lib: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.keys(lib).map((name) => [name.toLowerCase(), name]));

const lobehubIndex = indexLibrary(Lobehub as Record<string, unknown>);

const ICON_LIBRARIES: Readonly<Record<string, LibraryResolver>> = {
  lobehub: (brand) => {
    const exportName = lobehubIndex[brand.toLowerCase()];
    if (!exportName) return null;
    const entry = (Lobehub as Record<string, any>)[exportName];
    return entry?.Color ?? entry?.Avatar ?? null;
  },
  // Add `simpleicons` / other NPM icon packages here as needed:
  // simpleicons: (brand) => import('simple-icons').si[brand]?.svg ...
};

export const resolveLibraryIcon = (icon: string | undefined | null): LibraryIcon | null => {
  if (!icon) return null;
  const sep = icon.indexOf(':');
  if (sep <= 0) return null;
  const lib = icon.slice(0, sep);
  const resolver = ICON_LIBRARIES[lib];
  return resolver ? resolver(icon.slice(sep + 1)) : null;
};

