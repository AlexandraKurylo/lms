import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { fieldErrorMap, generalError } from '../../shared/lib/formErrors';
import { fileProblem, UPLOAD_ACCEPT } from '../../shared/lib/upload';
import { useAddMaterialFile } from '../../features/teacher/queries';
import { FormError } from '../FormError';
import { TextField } from '../TextField';
import styles from './FileMaterialForm.module.css';


export function FileMaterialForm({ lessonId }: { lessonId: number }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const add = useAddMaterialFile(lessonId);
  const errors = fieldErrorMap(add.error);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    const problem = chosen ? fileProblem(chosen) : '';
    setFileError(problem);
    setFile(chosen && !problem ? chosen : null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setFileError('Виберіть файл');
      return;
    }
    add.mutate(
      { file, title: title.trim() },
      {
        onSuccess: () => {
          setTitle('');
          setFile(null);
          if (input.current) input.current.value = '';
        },
      },
    );
  }

  const problem = fileError || errors['x-file-name'] || errors.body;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h3 className={styles.heading}>Завантажити файл</h3>
      <FormError message={generalError(add.error)} />
      <TextField
        label="Назва (за замовчуванням назва файлу)"
        name="fileTitle"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors['x-material-title']}
      />
      <div className={styles.picker}>
        <label htmlFor="materialFile" className={styles.label}>
          Файл (до 10 МБ)
        </label>
        <input ref={input} id="materialFile" type="file" accept={UPLOAD_ACCEPT} onChange={pick} />
        {problem && (
          <p className={styles.error} role="alert">
            {problem}
          </p>
        )}
      </div>
      <div>
        <button type="submit" className="btnSteel btnSm" disabled={add.isPending}>
          {add.isPending ? 'Завантажуємо…' : 'Завантажити'}
        </button>
      </div>
    </form>
  );
}
