import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { visualizer } from 'rollup-plugin-visualizer'

// Read root package.json for app version (one level up from client/)
// Falls back to '0.0.0' in Docker where only client/ is in the build context
let appVersion = '0.0.0'
try {
  const rootPkg = JSON.parse(readFileSync(resolve(process.cwd(), '..', 'package.json'), 'utf-8'))
  appVersion = rootPkg.version
} catch { /* Docker build - root package.json not available */ }

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from parent directory (root .env) for local development
  const fileEnv = loadEnv(mode, resolve(process.cwd(), '..'), '')

  // In Docker, env vars are set via ENV in Dockerfile, accessible via process.env
  // Priority: process.env (Docker) > fileEnv (local .env) > defaults
  const getEnv = (key, defaultValue = '') => {
    return process.env[key] || fileEnv[key] || defaultValue
  }

  // APP_VERSION: from root package.json locally, or VITE_APP_VERSION build arg in Docker
  const version = getEnv('VITE_APP_VERSION', '') || appVersion

  // Bundle visualizer: set ANALYZE=1 to emit dist/stats.html alongside the
  // normal build output. Zero cost when ANALYZE is unset — the plugin is
  // simply not added to the plugin chain. See docs-internal/credentials_scaling
  // for bundle-budget targets (main < 200 KB gz, per-panel < 50 KB gz).
  const analyze = !!getEnv('ANALYZE', '')

  // React Compiler 1.0 — auto-memoization. Scoped to the credentials
  // module first (Phase 7.5 of the credentials-scaling plan) so any perf
  // regressions are isolated from the rest of the app. Expand the
  // `sources` predicate module-by-module as each area is verified.
  //
  // Ref: docs-internal/credentials_scaling/research_react_stack.md
  //      docs-internal/platform_refactor/PLATFORM_REFACTOR_RFC.md Phase 7.5
  const reactCompilerConfig = {
    target: '19',
    sources: (filename) => {
      if (typeof filename !== 'string') return false
      const normalized = filename.replace(/\\/g, '/')
      return (
        normalized.includes('/src/components/credentials/') ||
        normalized.includes('/src/hooks/useCatalogueQuery.ts') ||
        normalized.includes('/src/store/useCredentialRegistry.ts')
      )
    },
  }

  return {
    plugins: [
      react({
        babel: {
          plugins: [
            ['babel-plugin-react-compiler', reactCompilerConfig],
          ],
        },
      }),
      ...(analyze
        ? [
            visualizer({
              filename: 'dist/stats.html',
              gzipSize: true,
              brotliSize: true,
              template: 'treemap',
              sourcemap: true,
            }),
          ]
        : []),
    ],
    // Expose VITE_ prefixed env vars to client code via import.meta.env
    define: {
      __APP_VERSION__: JSON.stringify(version),
      'import.meta.env.VITE_PYTHON_SERVICE_URL': JSON.stringify(getEnv('VITE_PYTHON_SERVICE_URL', '')),
      'import.meta.env.VITE_WHATSAPP_SERVICE_URL': JSON.stringify(getEnv('VITE_WHATSAPP_SERVICE_URL', '')),
      'import.meta.env.VITE_ANDROID_RELAY_URL': JSON.stringify(getEnv('VITE_ANDROID_RELAY_URL', '')),
    },
    resolve: {
      alias: {
        '@': resolve(process.cwd(), 'src'),
      },
    },
    server: {
      port: parseInt(getEnv('VITE_CLIENT_PORT', '3000')),
      strictPort: false,
      host: true
    },
    build: {
      // antd + reactflow are large libraries - this is expected
      chunkSizeWarningLimit: 1500,
      // Emit sourcemaps only when running the bundle analyzer so the
      // visualizer can attribute bytes to source files accurately.
      // Skipped in normal production builds to keep build time down.
      sourcemap: analyze,
    },
  }
})
