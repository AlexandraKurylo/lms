import { Outlet } from 'react-router-dom';
import { NavBar } from '../NavBar';
import styles from './Layout.module.css';

export function Layout() {
  return (
    <>
      <a href="#main" className={styles.skip}>
        Перейти до змісту
      </a>
      <NavBar />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}
