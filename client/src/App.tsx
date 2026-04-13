import React from 'react';
import { ConfigProvider, theme as antdThemeAlgorithm } from 'antd';
import Dashboard from './Dashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { lightTheme, darkTheme } from './config/antdTheme';
import { useTheme } from './contexts/ThemeContext';
import { Toaster } from 'sonner';

const App: React.FC = () => {
  const { isDarkMode } = useTheme();

  const currentTheme = isDarkMode ? {
    ...darkTheme,
    algorithm: antdThemeAlgorithm.darkAlgorithm,
  } : lightTheme;

  return (
    <ConfigProvider theme={currentTheme}>
      <ProtectedRoute>
        <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
          <Dashboard />
        </div>
      </ProtectedRoute>
      <Toaster theme={isDarkMode ? 'dark' : 'light'} position="top-right" richColors closeButton />
    </ConfigProvider>
  );
}

export default App
