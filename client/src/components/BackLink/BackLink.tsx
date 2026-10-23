import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './BackLink.module.css';

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.link}>
      ← {children}
    </Link>
  );
}
