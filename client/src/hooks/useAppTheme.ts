import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { theme as baseTheme, lightColors, darkColors } from '../styles/theme';

export const useAppTheme = () => {
  const { isDarkMode } = useTheme();

  const dynamicTheme = useMemo(() => {
    return {
      ...baseTheme,
      colors: isDarkMode ? darkColors : lightColors,
      isDarkMode,
    };
  }, [isDarkMode]);

  return dynamicTheme;
};
