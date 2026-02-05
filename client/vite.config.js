import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

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

  return {
    plugins: [react()],
    // Expose VITE_ prefixed env vars to client code via import.meta.env
    define: {
      __APP_VERSION__: JSON.stringify(version),
      'import.meta.env.VITE_AUTH_ENABLED': JSON.stringify(getEnv('VITE_AUTH_ENABLED', 'true')),
      'import.meta.env.VITE_PYTHON_SERVICE_URL': JSON.stringify(getEnv('VITE_PYTHON_SERVICE_URL', '')),
      'import.meta.env.VITE_WHATSAPP_SERVICE_URL': JSON.stringify(getEnv('VITE_WHATSAPP_SERVICE_URL', '')),
      'import.meta.env.VITE_ANDROID_RELAY_URL': JSON.stringify(getEnv('VITE_ANDROID_RELAY_URL', '')),
    },
    server: {
      port: parseInt(getEnv('VITE_CLIENT_PORT', '3000')),
      strictPort: false,
      host: true
    },
    build: {
      // antd + reactflow are large libraries - this is expected
      chunkSizeWarningLimit: 1500,
    },
  }
})
