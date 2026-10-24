import { useState, type FormEvent } from 'react';
import type { StreamInput } from '../../shared/api/types';
import { fieldErrorMap, generalError } from '../../shared/lib/formErrors';
import { FormError } from '../FormError';
import { TextField } from '../TextField';
import styles from './StreamForm.module.css';

interface StreamFormValues {
  title: string;
  startsOn: string;
  endsOn: string;
  capacity: string;
}

interface StreamFormProps {
  initial?: StreamInput;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: StreamInput, reset: () => void) => void;
  onCancel?: () => void;
}

const EMPTY: StreamFormValues = { title: '', startsOn: '', endsOn: '', capacity: '20' };

function toValues(initial?: StreamInput): StreamFormValues {
  return initial ? { ...initial, capacity: String(initial.capacity) } : EMPTY;
}

export function StreamForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: StreamFormProps) {
  const [values, setValues] = useState<StreamFormValues>(toValues(initial));
  const errors = fieldErrorMap(error);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ ...values, capacity: Number(values.capacity) }, () => setValues(EMPTY));
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <FormError message={generalError(error)} />
      <TextField
        label="Назва потоку"
        name="streamTitle"
        value={values.title}
        onChange={(e) => setValues({ ...values, title: e.target.value })}
        error={errors.title}
      />
      <div className={styles.row}>
        <TextField
          label="Початок"
          name="startsOn"
          type="date"
          value={values.startsOn}
          onChange={(e) => setValues({ ...values, startsOn: e.target.value })}
          error={errors.startsOn}
        />
        <TextField
          label="Завершення"
          name="endsOn"
          type="date"
          value={values.endsOn}
          onChange={(e) => setValues({ ...values, endsOn: e.target.value })}
          error={errors.endsOn}
        />
        <TextField
          label="Місць"
          name="capacity"
          type="number"
          min={1}
          max={1000}
          value={values.capacity}
          onChange={(e) => setValues({ ...values, capacity: e.target.value })}
          error={errors.capacity}
        />
      </div>
      <div className={styles.actions}>
        <button type="submit" className="btnSteel" disabled={pending}>
          {pending ? 'Зберігаємо…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btnGhost" onClick={onCancel}>
            Скасувати
          </button>
        )}
      </div>
    </form>
  );
}
