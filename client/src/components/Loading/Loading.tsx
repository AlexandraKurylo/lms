import styles from './Loading.module.css';

export function Loading({ text = 'Завантаження…' }: { text?: string }) {
  return (
    <p className={styles.text} role="status">
      {text}
    </p>
  );
}
