import type { ChangeEventHandler } from 'react';
import styles from './SelectField.module.css';

interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: ChangeEventHandler<HTMLSelectElement>;
  error?: string;
}

export function SelectField({ label, name, value, options, onChange, error }: SelectFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        className={error ? 'field fieldInvalid' : 'field'}
        value={value}
        onChange={onChange}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
