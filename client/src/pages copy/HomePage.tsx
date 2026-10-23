import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../shared/api/client';
import styles from './HomePage.module.css';

interface Health {
  status: 'ok';
}

function ServerStatus() {
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api<Health>('/health', { signal }),
  });

  if (isPending) return <span className={styles.statusText}>Перевіряємо сервер…</span>;
  if (error) {
    const message = error instanceof ApiError ? error.message : 'Сервер недоступний';
    return <span className={`${styles.statusText} ${styles.bad}`}>{message}</span>;
  }
  return (
    <span className={`${styles.statusText} ${styles.good}`}>Сервер працює: {data.status}</span>
  );
}

export function HomePage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={`fontDisplay ${styles.title}`}>Навчайтесь на курсах із живими потоками</h1>
        <p className={styles.lead}>
          Уроки, домашні роботи та прогрес в одному місці. Запишіться на потік, поки є вільні місця.
        </p>
        <div className={styles.actions}>
          <Link to="/courses" className="btnSteel">
            Каталог курсів
          </Link>
          <Link to="/register" className="btnGhost">
            Створити обліковий запис
          </Link>
        </div>
      </section>

      <section className={`glassPanel ${styles.status}`}>
        <span className={styles.statusLabel}>Стан сервера</span>
        <ServerStatus />
      </section>
    </div>
  );
}
