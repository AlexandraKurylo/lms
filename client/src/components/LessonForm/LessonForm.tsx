import { useState, type FormEvent } from 'react';
import type { LessonInput } from '../../shared/api/types';
import { fieldErrorMap, generalError } from '../../shared/lib/formErrors';
import { CheckboxField } from '../CheckboxField';
import { FormError } from '../FormError';
import { TextAreaField } from '../TextAreaField';
import { TextField } from '../TextField';
import styles from './LessonForm.module.css';

interface LessonFormProps {
  pending: boolean;
  error: unknown;
  onSubmit: (values: LessonInput, reset: () => void) => void;
}

const EMPTY: LessonInput = { title: '', content: '', isFreeIntro: false, hasHomework: false };

export function LessonForm({ pending, error, onSubmit }: LessonFormProps) {
  const [values, setValues] = useState<LessonInput>(EMPTY);
  const errors = fieldErrorMap(error);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values, () => setValues(EMPTY));
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <FormError message={generalError(error)} />
      <TextField
        label="Назва уроку"
        name="lessonTitle"
        value={values.title}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
        error={errors.title}
      />
      <TextAreaField
        label="Текст уроку"
        name="lessonContent"
        rows={6}
        value={values.content}
        onChange={(e) => setValues({ ...values, content: e.target.value })}
        error={errors.content}
      />
      <div className={styles.checks}>
        <CheckboxField
          label="Безкоштовний вступний урок"
          name="isFreeIntro"
          checked={values.isFreeIntro}
          onChange={(e) => setValues({ ...values, isFreeIntro: e.target.checked })}
        />
        <CheckboxField
          label="Є домашня робота"
          name="hasHomework"
          checked={values.hasHomework}
          onChange={(e) => setValues({ ...values, hasHomework: e.target.checked })}
        />
      </div>
      <button type="submit" className="btnSteel" disabled={pending}>
        {pending ? 'Додаємо…' : 'Додати урок'}
      </button>
    </form>
  );
}
