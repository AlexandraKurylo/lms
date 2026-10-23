import styles from './Page.module.css';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className={`glassPanel ${styles.panel}`}>
      <h1 className={`fontDisplay ${styles.title}`}>{title}</h1>
      <p className={styles.muted}>Ця сторінка з’явиться на одному з наступних кроків.</p>
    </section>
  );
}
