import type { ReactNode } from 'react';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  title: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, footer, children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <section className={`glassPanel ${styles.card}`}>
        <h1 className={`fontDisplay ${styles.title}`}>{title}</h1>
        {children}
        <p className={styles.footer}>{footer}</p>
      </section>
    </div>
  );
}
