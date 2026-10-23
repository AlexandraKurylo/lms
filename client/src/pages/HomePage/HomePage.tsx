import { Link } from 'react-router-dom';
import { ServerStatus } from '../../components/ServerStatus';
import styles from './HomePage.module.css';

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
