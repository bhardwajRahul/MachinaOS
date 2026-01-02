import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from parent directory (root .env)
  const env = loadEnv(mode, resolve(process.cwd(), '..'), '')

  return {
    plugins: [react()],
    // Expose VITE_ prefixed env vars to client code via import.meta.env
    define: {
      'import.meta.env.VITE_AUTH_ENABLED': JSON.stringify(env.VITE_AUTH_ENABLED || 'true'),
      'import.meta.env.VITE_PYTHON_SERVICE_URL': JSON.stringify(env.VITE_PYTHON_SERVICE_URL || ''),
      'import.meta.env.VITE_WHATSAPP_SERVICE_URL': JSON.stringify(env.VITE_WHATSAPP_SERVICE_URL || ''),
      'import.meta.env.VITE_ANDROID_RELAY_URL': JSON.stringify(env.VITE_ANDROID_RELAY_URL || ''),
    },
    server: {
      port: parseInt(env.VITE_CLIENT_PORT) || 3000,
      strictPort: false,
      host: true
    },
  }
})
