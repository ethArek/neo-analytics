import type React from 'react';
import { useTheme } from '../theme';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const label = nextTheme === 'dark' ? 'Dark mode' : 'Light mode';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${label.toLowerCase()}`}
      aria-pressed={theme === 'dark'}
      onClick={() => {
        toggleTheme();
      }}
    >
      {theme === 'dark' ? (
        <svg
          aria-hidden="true"
          className="theme-toggle-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2" />
          <path d="M12 19.3v2.2" />
          <path d="m5.28 5.28 1.56 1.56" />
          <path d="m17.16 17.16 1.56 1.56" />
          <path d="M2.5 12h2.2" />
          <path d="M19.3 12h2.2" />
          <path d="m5.28 18.72 1.56-1.56" />
          <path d="m17.16 6.84 1.56-1.56" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          className="theme-toggle-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
};
