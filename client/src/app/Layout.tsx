import { Outlet } from 'react-router-dom';
import { NavBar } from '../shared/ui/NavBar';
import styles from './Layout.module.css';

export function Layout() {
  return (
    <>
      <NavBar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}
