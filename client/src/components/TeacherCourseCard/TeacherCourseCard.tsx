import { Link } from 'react-router-dom';
import type { OwnCourse } from '../../shared/api/types';
import { COURSE_STATUS_LABEL, LEVEL_LABEL, plural } from '../../shared/lib/format';
import styles from './TeacherCourseCard.module.css';

export function TeacherCourseCard({ course }: { course: OwnCourse }) {
  return (
    <Link to={`/teacher/courses/${course.id}`} className={`glassPanel ${styles.card}`}>
      <div className={styles.badges}>
        <span className="badge">{COURSE_STATUS_LABEL[course.status]}</span>
        <span className="badge">{LEVEL_LABEL[course.level]}</span>
      </div>
      <h2 className={`fontDisplay ${styles.title}`}>{course.title}</h2>
      <span className={styles.muted}>
        {course.lessonCount} {plural(course.lessonCount, 'урок', 'уроки', 'уроків')}
      </span>
    </Link>
  );
}
