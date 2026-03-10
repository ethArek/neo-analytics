import type React from 'react';
import { createContext, useContext, useLayoutEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'neo-analytics-theme';
const THEME_ATTRIBUTE = 'data-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getStoredTheme = (): Theme | null => {
  const storedTheme = window.localStorage.getItem(STORAGE_KEY);

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return null;
};

const getPreferredTheme = (): Theme => {
  const storedTheme = getStoredTheme();

  if (storedTheme) {
    return storedTheme;
  }

  return 'dark';
};

const applyTheme = (theme: Theme) => {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.documentElement.style.colorScheme = theme;
};

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());

  useLayoutEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => {
          setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const contextValue = useContext(ThemeContext);

  if (!contextValue) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }

  return contextValue;
};
