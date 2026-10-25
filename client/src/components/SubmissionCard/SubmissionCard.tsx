import { useState, type FormEvent } from 'react';
import { useGradeSubmission } from '../../features/teacher/queries';
import type { StreamSubmission } from '../../shared/api/types';
import { fieldErrorMap, generalError } from '../../shared/lib/formErrors';
import { formatDateTime } from '../../shared/lib/format';
import { FormError } from '../FormError';
import { TextAreaField } from '../TextAreaField';
import { TextField } from '../TextField';
import styles from './SubmissionCard.module.css';

export function SubmissionCard({
  streamId,
  submission,
}: {
  streamId: number;
  submission: StreamSubmission;
}) {
  const [grade, setGrade] = useState(submission.grade === null ? '' : String(submission.grade));
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const save = useGradeSubmission(streamId, submission.id);
  const errors = fieldErrorMap(save.error);
  const graded = submission.grade !== null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ grade: grade === '' ? Number.NaN : Number(grade), feedback });
  }

  return (
    <article className={`glassPanel ${styles.card}`}>
      <header className={styles.head}>
        <div className={styles.who}>
          <strong>{submission.student.name}</strong>
          <span className={styles.muted}>
            Урок {submission.lesson.position}. {submission.lesson.title}
          </span>
        </div>
        <div className={styles.meta}>
          <span className="badge">{graded ? `Оцінка: ${submission.grade}` : 'Не перевірено'}</span>
          <span className={styles.muted}>{formatDateTime(submission.submittedAt)}</span>
        </div>
      </header>

      {submission.comment && <p className={styles.answer}>{submission.comment}</p>}
      {submission.file && (
        <a href={`/api/teacher/submissions/${submission.id}/file`} className={styles.file}>
          Файл: {submission.file.name}
        </a>
      )}

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <FormError message={generalError(save.error)} />
        <div className={styles.grade}>
          <TextField
            label="Оцінка (0–100)"
            name={`grade-${submission.id}`}
            type="number"
            min={0}
            max={100}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            error={errors.grade}
          />
        </div>
        <TextAreaField
          label="Коментар викладача"
          name={`feedback-${submission.id}`}
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          error={errors.feedback}
        />
        <div className={styles.actions}>
          <button type="submit" className="btnSteel btnSm" disabled={save.isPending}>
            {save.isPending ? 'Зберігаємо…' : graded ? 'Змінити оцінку' : 'Оцінити'}
          </button>
          {save.isSuccess && (
            <span className={styles.saved} role="status">
              Збережено
            </span>
          )}
        </div>
      </form>
    </article>
  );
}
