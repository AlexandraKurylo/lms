import { Link } from 'react-router-dom';
import type { LessonProgressItem } from '../../shared/api/types';
import styles from './LearnLessonList.module.css';

export function LearnLessonList({ lessons }: { lessons: LessonProgressItem[] }) {
  return (
    <ol className={`glassPanel ${styles.list}`}>
      {lessons.map((l) => (
        <li key={l.id} className={styles.item}>
          <span className={l.completed ? `${styles.position} ${styles.done}` : styles.position}>
            {l.completed ? '✓' : l.position}
          </span>
          {l.locked ? (
            <span className={`${styles.title} ${styles.locked}`}>{l.title}</span>
          ) : (
            <Link to={`/lessons/${l.id}`} className={`${styles.title} ${styles.link}`}>
              {l.title}
            </Link>
          )}
          {l.hasHomework && <span className="badge">Домашня робота</span>}
          {l.locked && <span className="badge">Закрито</span>}
          {l.completed && <span className="badge">Пройдено</span>}
        </li>
      ))}
    </ol>
  );
}
