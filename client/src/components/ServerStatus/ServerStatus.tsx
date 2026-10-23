import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../shared/api/client';
import styles from './ServerStatus.module.css';

interface Health {
  status: 'ok';
}

export function ServerStatus() {
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api<Health>('/health', { signal }),
  });

  if (isPending) return <span className={styles.text}>Перевіряємо сервер…</span>;
  if (error) {
    const message = error instanceof ApiError ? error.message : 'Сервер недоступний';
    return <span className={`${styles.text} ${styles.bad}`}>{message}</span>;
  }
  return <span className={`${styles.text} ${styles.good}`}>Сервер працює: {data.status}</span>;
}
