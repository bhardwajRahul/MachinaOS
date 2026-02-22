/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANDROID_RELAY_URL: string;
  readonly VITE_AUTH_ENABLED: string;
  readonly VITE_CLIENT_PORT: string;
  readonly VITE_PYTHON_BACKEND_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Allow importing SVG files as raw strings
declare module '*.svg?raw' {
  const content: string;
  export default content;
}
