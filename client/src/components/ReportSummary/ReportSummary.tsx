import type { StreamReport } from '../../shared/api/types';
import styles from './ReportSummary.module.css';

export function ReportSummary({ summary }: { summary: StreamReport['summary'] }) {
  const tiles = [
    { label: 'Студентів', value: String(summary.students) },
    { label: 'Пройшли всі уроки', value: String(summary.finished) },
    { label: 'Середній прогрес', value: `${summary.averageProgress}%` },
    {
      label: 'Домашні роботи',
      value: `${summary.homeworkGraded} з ${summary.homeworkSubmitted}`,
      hint: 'оцінено з надісланих',
    },
    {
      label: 'Середня оцінка',
      value: summary.averageGrade === null ? '—' : String(summary.averageGrade),
    },
  ];

  return (
    <dl className={styles.grid}>
      {tiles.map((tile) => (
        <div key={tile.label} className={`glassPanel ${styles.tile}`}>
          <dt className={styles.label}>{tile.label}</dt>
          <dd className={styles.value}>{tile.value}</dd>
          {tile.hint && <dd className={styles.hint}>{tile.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
