import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from parent directory (root .env) for local development
  const fileEnv = loadEnv(mode, resolve(process.cwd(), '..'), '')

  // In Docker, env vars are set via ENV in Dockerfile, accessible via process.env
  // Priority: process.env (Docker) > fileEnv (local .env) > defaults
  const getEnv = (key, defaultValue = '') => {
    return process.env[key] || fileEnv[key] || defaultValue
  }

  return {
    plugins: [react()],
    // Expose VITE_ prefixed env vars to client code via import.meta.env
    define: {
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
  }
})
