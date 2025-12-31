import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(process.cwd(), '..'), '')
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_CLIENT_PORT),
      strictPort: false,
      host: true
    },
  }
})
