import type { StreamStudent } from '../../shared/api/types';
import { ProgressBar } from '../ProgressBar';
import styles from './StreamStudentList.module.css';

export function StreamStudentList({ students }: { students: StreamStudent[] }) {
  if (students.length === 0) {
    return <p className={styles.empty}>На цей потік ще ніхто не записався.</p>;
  }
  return (
    <ul className={styles.list}>
      {students.map((s) => (
        <li key={s.enrollmentId} className={`glassPanel ${styles.item}`}>
          <div className={styles.who}>
            <strong>{s.name}</strong>
            <span className={styles.muted}>{s.email}</span>
          </div>
          <div className={styles.progress}>
            <ProgressBar percent={s.progress.percent} label={`Прогрес: ${s.name}`} />
            <span className={styles.muted}>
              Уроків: {s.progress.completed} з {s.progress.total}
            </span>
          </div>
          <div className={styles.homework}>
            <span className="badge">
              Роботи: {s.homework.submitted} з {s.homework.total}
            </span>
            <span className={styles.muted}>Оцінено: {s.homework.graded}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
