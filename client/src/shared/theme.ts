const KEY = 'lms-theme';
const META_COLOR = { dark: '#0f191c', light: '#eef4f5' } as const;

export type Theme = keyof typeof META_COLOR;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    return;
  }
}
