import { useState, type FormEvent } from 'react';
import type { LinkMaterialInput } from '../../shared/api/types';
import { fieldErrorMap, generalError } from '../../shared/lib/formErrors';
import { useAddMaterialLink } from '../../features/teacher/queries';
import { FormError } from '../FormError';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
import styles from './LinkMaterialForm.module.css';


const KINDS: { value: LinkMaterialInput['kind']; label: string }[] = [
  { value: 'link', label: 'Посилання' },
  { value: 'video', label: 'Відео' },
  { value: 'article', label: 'Стаття' },
];

export function LinkMaterialForm({ lessonId }: { lessonId: number }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<LinkMaterialInput['kind']>('link');
  const [url, setUrl] = useState('');
  const add = useAddMaterialLink(lessonId);
  const errors = fieldErrorMap(add.error);

  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate(
      { title, kind, url },
      {
        onSuccess: () => {
          setTitle('');
          setUrl('');
        },
      },
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h3 className={styles.title}>Додати посилання</h3>
      <FormError message={generalError(add.error)} />
      <div className={styles.row}>
        <TextField
          label="Назва"
          name="linkTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <SelectField
          label="Тип"
          name="linkKind"
          value={kind}
          options={KINDS}
          onChange={(e) => setKind(e.target.value as LinkMaterialInput['kind'])}
          error={errors.kind}
        />
      </div>
      <TextField
        label="Адреса"
        name="linkUrl"
        type="url"
        placeholder="https://"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        error={errors.url}
      />
      <div>
        <button type="submit" className="btnSteel btnSm" disabled={add.isPending}>
          {add.isPending ? 'Додаємо…' : 'Додати'}
        </button>
      </div>
    </form>
  );
}
