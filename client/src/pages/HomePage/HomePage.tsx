import { Link } from 'react-router-dom';
import { FeatureCard } from '../../components/FeatureCard';
import { Reveal } from '../../components/Reveal';
import styles from './HomePage.module.css';

const FEATURES = [
  {
    title: 'Потоки з живими місцями',
    text: 'Записуйтесь на потік і бачте вільні місця в реальному часі: останнє місце гарантовано дістається одному студентові.',
  },
  {
    title: 'Прогрес без фальші',
    text: 'Відсоток проходження рахується з позначок про пройдені уроки, тож додайте новий урок, і прогрес лишиться точним.',
  },
  {
    title: 'Зворотний зв’язок від викладача',
    text: 'Здавайте домашні роботи з файлами й отримуйте оцінку та коментар: усе в одному кабінеті, без зайвих листів.',
  },
] as const;

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

      <section className={styles.features} aria-label="Можливості платформи">
        {FEATURES.map((feature, index) => (
          <Reveal
            key={feature.title}
            direction={index === 0 ? 'left' : index === 2 ? 'right' : 'up'}
            delay={index * 120}
          >
            <FeatureCard title={feature.title} text={feature.text} />
          </Reveal>
        ))}
      </section>
    </div>
  );
}
