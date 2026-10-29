import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { ThemeToggle } from '../ThemeToggle';
import styles from './NavBar.module.css';

function linkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
}

export function NavBar() {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  function leave() {
    closeMenu();
    logout.mutate();
  }

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo} onClick={closeMenu}>
          <img src="/favicon.svg" alt="" width="32" height="32" className={styles.logoImg} />
          <span className={styles.logoText}>LMS</span>
        </Link>

        <div className={styles.desktop}>
          <NavLink to="/courses" className={linkClass}>
            Каталог курсів
          </NavLink>
          {user?.role === 'student' && (
            <NavLink to="/my-enrollments" className={linkClass}>
              Мої записи
            </NavLink>
          )}
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <NavLink to="/teacher" className={linkClass}>
              Кабінет
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin/report" className={linkClass}>
              Звіти
            </NavLink>
          )}
          {!loading &&
            (user ? (
              <>
                <NavLink to="/account" className={linkClass}>
                  {user.name}
                </NavLink>
                <button type="button" className="btnSteel" onClick={leave}>
                  Вийти
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={linkClass}>
                  Увійти
                </NavLink>
                <NavLink to="/register" className="btnSteel">
                  Реєстрація
                </NavLink>
              </>
            ))}
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
            <NavLink to="/courses" onClick={closeMenu} className={styles.menuLink}>
              Каталог курсів
            </NavLink>
            {user?.role === 'student' && (
              <NavLink to="/my-enrollments" onClick={closeMenu} className={styles.menuLink}>
                Мої записи
              </NavLink>
            )}
            {(user?.role === 'teacher' || user?.role === 'admin') && (
              <NavLink to="/teacher" onClick={closeMenu} className={styles.menuLink}>
                Кабінет
              </NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin/report" onClick={closeMenu} className={styles.menuLink}>
                Звіти
              </NavLink>
            )}
            {!loading &&
              (user ? (
                <>
                  <NavLink to="/account" onClick={closeMenu} className={styles.menuLink}>
                    {user.name}
                  </NavLink>
                  <button type="button" className={`btnSteel ${styles.menuButton}`} onClick={leave}>
                    Вийти
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" onClick={closeMenu} className={styles.menuLink}>
                    Увійти
                  </NavLink>
                  <NavLink
                    to="/register"
                    onClick={closeMenu}
                    className={`btnSteel ${styles.menuButton}`}
                  >
                    Реєстрація
                  </NavLink>
                </>
              ))}
          </div>
        </div>
      )}
    </header>
  );
}
