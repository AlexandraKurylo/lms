import type { LessonOutline } from '../../shared/api/types';
import { plural } from '../../shared/lib/format';
import styles from './LessonList.module.css';

export function LessonList({
  lessons,
  sequential,
}: {
  lessons: LessonOutline[];
  sequential: boolean;
}) {
  return (
    <>
      <ol className={`glassPanel ${styles.list}`}>
        {lessons.map((l) => (
          <li key={l.id} className={styles.item}>
            <span className={styles.position}>{l.position}</span>
            <span className={styles.title}>{l.title}</span>
            {l.isFreeIntro && <span className="badge">Безкоштовно</span>}
            {l.hasHomework && <span className="badge">Домашня робота</span>}
          </li>
        ))}
      </ol>
      <p className={styles.summary}>
        {lessons.length} {plural(lessons.length, 'урок', 'уроки', 'уроків')}
        {sequential && ', уроки відкриваються по черзі'}
      </p>
    </>
  );
}
