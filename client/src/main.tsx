import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './design-system/tokens/index.css'
import './index.css'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { WebSocketProvider } from './contexts/WebSocketContext'

// Single app-wide QueryClient. Cache lives across route changes and modal
// open/close cycles, which is what makes the credentials catalogue warm
// start (<50 ms on second visit) actually work. See
// docs-internal/credentials_scaling/architecture.md for the full shape.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default is aggressive refetching; for this app most server data
      // is push-driven via WebSocket, so queries should stay stable
      // unless we explicitly invalidate them.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
            <App />
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
