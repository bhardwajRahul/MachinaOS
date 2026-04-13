import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * App-wide toast renderer. Mount once near the root (App.tsx).
 * Drives theme from ThemeContext so tokens come from CSS vars automatically.
 */
export function Toaster() {
  const { isDarkMode } = useTheme();
  return (
    <SonnerToaster
      theme={isDarkMode ? 'dark' : 'light'}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        style: {
          fontFamily: 'var(--font-sans)',
          borderRadius: 'var(--radius-md)',
        },
      }}
    />
  );
}
