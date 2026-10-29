import { Link, useSearchParams } from 'react-router-dom';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Loading } from '../../components/Loading';
import { ReportSummary } from '../../components/ReportSummary';
import { ReportTable } from '../../components/ReportTable';
import { SelectField } from '../../components/SelectField';
import { useAllStreams, useStreamReport } from '../../features/admin/queries';
import { formatDate } from '../../shared/lib/format';
import styles from './AdminReportPage.module.css';

export function AdminReportPage() {
  const [params, setParams] = useSearchParams();
  const streams = useAllStreams();
  const raw = Number(params.get('stream'));
  const streamId = Number.isInteger(raw) && raw > 0 ? raw : null;
  const report = useStreamReport(streamId);

  const options = [
    { value: '', label: 'Оберіть потік' },
    ...(streams.data?.items ?? []).map((s) => ({
      value: String(s.id),
      label: `${s.course.title}: ${s.title} (${formatDate(s.startsOn)})`,
    })),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={`fontDisplay ${styles.title}`}>Звіт про успішність за потоком</h1>
        <p className={styles.lead}>Прогрес, домашні роботи й оцінки студентів обраного потоку.</p>
      </header>

      {streams.isPending && <Loading />}
      {streams.error && <ErrorMessage error={streams.error} />}
      {streams.data && streams.data.items.length === 0 && (
        <p className={styles.empty}>Потоків ще немає.</p>
      )}
      {streams.data && streams.data.items.length > 0 && (
        <div className={`glassPanel ${styles.picker}`}>
          <SelectField
            label="Потік"
            name="report-stream"
            value={streamId === null ? '' : String(streamId)}
            options={options}
            onChange={(event) => {
              const value = event.target.value;
              setParams(value ? { stream: value } : {});
            }}
          />
        </div>
      )}

      {streamId !== null && report.isPending && <Loading text="Формуємо звіт…" />}
      {streamId !== null && report.error && (
        <ErrorMessage error={report.error} notFoundText="Потік не знайдено" />
      )}
      {report.data && streamId !== null && (
        <section className={styles.report} aria-label="Звіт за потоком">
          <div className={styles.meta}>
            <h2 className={`fontDisplay ${styles.h2}`}>
              {report.data.stream.course.title}: {report.data.stream.title}
            </h2>
            <p className={styles.muted}>
              {formatDate(report.data.stream.startsOn)} — {formatDate(report.data.stream.endsOn)} ·
              Місць: {report.data.stream.seatsTaken} з {report.data.stream.capacity} · Викладач:{' '}
              {report.data.stream.teacher?.name ?? 'не призначено'}
            </p>
            <Link to={`/teacher/streams/${report.data.stream.id}`} className={styles.link}>
              Відкрити потік у кабінеті
            </Link>
          </div>
          <ReportSummary summary={report.data.summary} />
          <ReportTable students={report.data.students} />
        </section>
      )}
    </div>
  );
}
