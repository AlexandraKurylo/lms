import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../theme';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const [theme, setCurrent] = useState<Theme>(getTheme());
  const isLight = theme === 'light';

  function toggle() {
    const next: Theme = isLight ? 'dark' : 'light';
    setTheme(next);
    setCurrent(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? 'Увімкнути темну тему' : 'Увімкнути світлу тему'}
      title={isLight ? 'Темна тема' : 'Світла тема'}
      className={styles.toggle}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isLight ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
