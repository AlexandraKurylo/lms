import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import styles from './NavBar.module.css';

const LINKS = [
  { to: '/courses', label: 'Каталог курсів' },
  { to: '/login', label: 'Увійти' },
];

function linkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
}

export function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo} onClick={closeMenu}>
          <img src="/favicon.svg" alt="" width="32" height="32" className={styles.logoImg} />
          <span className={styles.logoText}>LMS</span>
        </Link>

        <div className={styles.desktop}>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/register" className="btnSteel">
            Реєстрація
          </NavLink>
          <ThemeToggle />
        </div>

        <div className={styles.mobileControls}>
          <ThemeToggle />
          <button
            type="button"
            className={styles.burger}
            aria-label={menuOpen ? 'Закрити меню' : 'Відкрити меню'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path
                  d="M1 1L17 13M17 1L1 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M0 1H18M0 7H18M0 13H18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          <div className={styles.menuList}>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={closeMenu} className={styles.menuLink}>
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/register" onClick={closeMenu} className={`btnSteel ${styles.menuButton}`}>
              Реєстрація
            </NavLink>
          </div>
        </div>
      )}
    </header>
  );
}
