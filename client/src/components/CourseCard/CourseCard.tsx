import { Link } from 'react-router-dom';
import type { CourseSummary } from '../../shared/api/types';
import { LEVEL_LABEL, plural } from '../../shared/lib/format';
import styles from './CourseCard.module.css';

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link to={`/courses/${course.id}`} className={`glassPanel ${styles.card}`}>
      <div className={styles.badges}>
        <span className="badge">{LEVEL_LABEL[course.level]}</span>
        {course.topics.map((t) => (
          <span key={t} className="badge">
            {t}
          </span>
        ))}
      </div>
      <h2 className={`fontDisplay ${styles.title}`}>{course.title}</h2>
      <p className={styles.text}>{course.description}</p>
      <div className={styles.footer}>
        <span>{course.teacher?.name ?? 'Викладача не призначено'}</span>
        <span>
          {course.lessonCount} {plural(course.lessonCount, 'урок', 'уроки', 'уроків')}
        </span>
      </div>
    </Link>
  );
}
