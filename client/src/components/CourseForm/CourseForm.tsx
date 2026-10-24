import { useState, type FormEvent } from 'react';
import type { CourseInput, Level } from '../../shared/api/types';
import { fieldErrorMap, generalError } from '../../shared/lib/formErrors';
import { LEVEL_LABEL } from '../../shared/lib/format';
import { CheckboxField } from '../CheckboxField';
import { FormError } from '../FormError';
import { SelectField } from '../SelectField';
import { TextAreaField } from '../TextAreaField';
import { TextField } from '../TextField';
import styles from './CourseForm.module.css';

interface CourseFormProps {
  initial?: CourseInput;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: CourseInput) => void;
}

const EMPTY: CourseInput = {
  title: '',
  description: '',
  language: 'uk',
  level: 'beginner',
  sequentialLessons: true,
};

const LEVEL_OPTIONS = Object.entries(LEVEL_LABEL).map(([value, label]) => ({ value, label }));

export function CourseForm({
  initial = EMPTY,
  submitLabel,
  pending,
  error,
  onSubmit,
}: CourseFormProps) {
  const [values, setValues] = useState<CourseInput>(initial);
  const errors = fieldErrorMap(error);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <FormError message={generalError(error)} />
      <TextField
        label="Назва"
        name="title"
        value={values.title}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
        error={errors.title}
      />
      <TextAreaField
        label="Опис"
        name="description"
        rows={4}
        value={values.description}
        onChange={(e) => setValues({ ...values, description: e.target.value })}
        error={errors.description}
      />
      <div className={styles.row}>
        <SelectField
          label="Рівень"
          name="level"
          value={values.level}
          options={LEVEL_OPTIONS}
          onChange={(e) => setValues({ ...values, level: e.target.value as Level })}
          error={errors.level}
        />
        <TextField
          label="Мова (код)"
          name="language"
          maxLength={2}
          value={values.language}
          onChange={(e) => setValues({ ...values, language: e.target.value.toLowerCase() })}
          error={errors.language}
        />
      </div>
      <CheckboxField
        label="Уроки відкриваються по черзі"
        name="sequentialLessons"
        checked={values.sequentialLessons}
        onChange={(e) => setValues({ ...values, sequentialLessons: e.target.checked })}
      />
      <button type="submit" className="btnSteel" disabled={pending}>
        {pending ? 'Зберігаємо…' : submitLabel}
      </button>
    </form>
  );
}
