import React from 'react';
import { useTheme } from '../../lib/theme';
import { SunIcon, MoonIcon } from '../../layout/nav-icons';
import './ThemeToggle.css';

export const ThemeToggle: React.FC = () => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle${isDark ? ' theme-toggle--dark' : ''}`}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="theme-toggle__track">
        <span className="theme-toggle__thumb" />
      </span>
      <span className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden>
        <SunIcon width={13} height={13} />
      </span>
      <span className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden>
        <MoonIcon width={12} height={12} />
      </span>
    </button>
  );
};
