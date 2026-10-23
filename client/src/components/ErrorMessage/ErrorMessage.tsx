import { ApiError } from '../../shared/api/client';
import styles from './ErrorMessage.module.css';

export function ErrorMessage({ error, notFoundText }: { error: unknown; notFoundText?: string }) {
  const text =
    error instanceof ApiError
      ? error.status === 404 && notFoundText
        ? notFoundText
        : error.message
      : 'Щось пішло не так';
  return <p className={styles.text}>{text}</p>;
}
