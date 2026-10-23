import { ApiError } from '../api/client';
import styles from './StateMessage.module.css';

export function Loading({ text = 'Завантаження…' }: { text?: string }) {
  return <p className={styles.muted}>{text}</p>;
}

export function ErrorMessage({ error, notFoundText }: { error: unknown; notFoundText?: string }) {
  const text =
    error instanceof ApiError
      ? error.status === 404 && notFoundText
        ? notFoundText
        : error.message
      : 'Щось пішло не так';
  return <p className={styles.error}>{text}</p>;
}
