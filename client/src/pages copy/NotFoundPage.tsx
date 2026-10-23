import { Link } from 'react-router-dom';
import styles from './Page.module.css';

export function NotFoundPage() {
  return (
    <section className={`glassPanel ${styles.panel}`}>
      <h1 className={`fontDisplay ${styles.title}`}>Сторінку не знайдено</h1>
      <p className={styles.muted}>Перевірте адресу або поверніться на головну.</p>
      <Link to="/" className="btnSteel">
        На головну
      </Link>
    </section>
  );
}
