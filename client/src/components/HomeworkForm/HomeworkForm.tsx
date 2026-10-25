import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRemoveHomeworkFile, useSubmitHomework } from '../../features/learning/queries';
import type { Submission } from '../../shared/api/types';
import { fieldErrorMap, generalError } from '../../shared/lib/formErrors';
import { formatDateTime } from '../../shared/lib/format';
import { fileProblem, UPLOAD_ACCEPT } from '../../shared/lib/upload';
import { FormError } from '../FormError';
import { TextAreaField } from '../TextAreaField';
import styles from './HomeworkForm.module.css';

export function HomeworkForm({
  lessonId,
  submission,
}: {
  lessonId: number;
  submission: Submission | null;
}) {
  const [comment, setComment] = useState(submission?.comment ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const submit = useSubmitHomework(lessonId);
  const remove = useRemoveHomeworkFile(lessonId);
  const errors = fieldErrorMap(submit.error);
  const graded = submission !== null && submission.grade !== null;
  const fileUrl = `/api/lessons/${lessonId}/submission/file`;

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    setFileError(chosen ? fileProblem(chosen) : '');
    setFile(chosen && !fileProblem(chosen) ? chosen : null);
  }

  function clearPicked() {
    setFile(null);
    setFileError('');
    if (input.current) input.current.value = '';
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate({ comment, file }, { onSuccess: clearPicked });
  }

  return (
    <section className={`glassPanel ${styles.box}`}>
      <h2 className={`fontDisplay ${styles.title}`}>Домашнє завдання</h2>

      {submission && (
        <p className={styles.status} role="status">
          Надіслано {formatDateTime(submission.submittedAt)}
          {!graded && ', чекає на перевірку'}
        </p>
      )}

      {graded && submission ? (
        <div className={styles.result}>
          <p className={styles.grade}>
            Оцінка: <strong>{submission.grade}</strong> з 100
          </p>
          {submission.feedback && <p className={styles.feedback}>{submission.feedback}</p>}
          {submission.comment && <p className={styles.answer}>{submission.comment}</p>}
          {submission.file && (
            <a href={fileUrl} className={styles.file}>
              Файл: {submission.file.name}
            </a>
          )}
        </div>
      ) : (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <FormError message={generalError(submit.error) || generalError(remove.error)} />
          <TextAreaField
            label="Ваша відповідь"
            name="homeworkComment"
            rows={8}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            error={errors.comment}
          />

          <div className={styles.attach}>
            <label htmlFor="homeworkFile" className={styles.label}>
              Файл (необов’язково, до 10 МБ)
            </label>
            {submission?.file && (
              <div className={styles.current}>
                <a href={fileUrl} className={styles.file}>
                  {submission.file.name}
                </a>
                <button
                  type="button"
                  className="btnGhost btnSm"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {remove.isPending ? 'Видаляємо…' : 'Видалити файл'}
                </button>
              </div>
            )}
            <input
              ref={input}
              id="homeworkFile"
              type="file"
              accept={UPLOAD_ACCEPT}
              onChange={pick}
            />
            {submission?.file && file && (
              <p className={styles.hint}>Новий файл замінить поточний</p>
            )}
            {(fileError || errors['x-file-name'] || errors.body) && (
              <p className={styles.error} role="alert">
                {fileError || errors['x-file-name'] || errors.body}
              </p>
            )}
          </div>

          <div>
            <button type="submit" className="btnSteel" disabled={submit.isPending}>
              {submit.isPending ? 'Надсилаємо…' : submission ? 'Оновити відповідь' : 'Надіслати'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
