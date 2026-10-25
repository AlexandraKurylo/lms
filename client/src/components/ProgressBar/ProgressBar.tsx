import styles from './ProgressBar.module.css';

export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div className={styles.box}>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label ?? 'Прогрес'}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.value}>{percent}%</span>
    </div>
  );
}
