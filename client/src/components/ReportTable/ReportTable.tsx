import type { StreamReportStudent } from '../../shared/api/types';
import { ENROLLMENT_STATUS_LABEL } from '../../shared/lib/format';
import { ProgressBar } from '../ProgressBar';
import styles from './ReportTable.module.css';

export function ReportTable({ students }: { students: StreamReportStudent[] }) {
  if (students.length === 0) {
    return <p className={styles.empty}>На цей потік ще ніхто не записався.</p>;
  }

  return (
    <div
      className={`glassPanel ${styles.wrap}`}
      role="region"
      aria-label="Таблиця студентів"
      tabIndex={0}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Студент</th>
            <th scope="col">Статус</th>
            <th scope="col">Прогрес</th>
            <th scope="col" className={styles.num}>
              Роботи
            </th>
            <th scope="col" className={styles.num}>
              Оцінено
            </th>
            <th scope="col" className={styles.num}>
              Сер. оцінка
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.enrollmentId}>
              <th scope="row">
                <div className={styles.who}>
                  <span>{s.name}</span>
                  <span className={styles.email}>{s.email}</span>
                </div>
              </th>
              <td data-label="Статус">{ENROLLMENT_STATUS_LABEL[s.status]}</td>
              <td className={styles.progress} data-label="Прогрес">
                <ProgressBar percent={s.progress.percent} label={`Прогрес: ${s.name}`} />
                <span className={styles.email}>
                  {s.progress.completed} з {s.progress.total} уроків
                </span>
              </td>
              <td className={styles.num} data-label="Роботи">
                {s.homework.submitted} з {s.homework.total}
              </td>
              <td className={styles.num} data-label="Оцінено">
                {s.homework.graded}
              </td>
              <td className={styles.num} data-label="Сер. оцінка">
                {s.averageGrade ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
