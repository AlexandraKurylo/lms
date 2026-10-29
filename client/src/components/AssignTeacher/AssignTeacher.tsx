import { useState } from 'react';
import { useAssignTeacher, useTeachers } from '../../features/admin/queries';
import { generalError } from '../../shared/lib/formErrors';
import { FormError } from '../FormError';
import { SelectField } from '../SelectField';
import styles from './AssignTeacher.module.css';

export function AssignTeacher({
  courseId,
  teacherId,
}: {
  courseId: number;
  teacherId: number | null;
}) {
  const teachers = useTeachers();
  const assign = useAssignTeacher(courseId);
  const [choice, setChoice] = useState(teacherId === null ? '' : String(teacherId));

  const options = [
    ...(teacherId === null ? [{ value: '', label: 'Викладача не призначено' }] : []),
    ...(teachers.data?.items ?? []).map((t) => ({ value: String(t.id), label: t.name })),
  ];
  const unchanged = choice === '' || Number(choice) === teacherId;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        assign.mutate(Number(choice));
      }}
    >
      {teachers.isPending ? (
        <p className={styles.hint}>Завантаження викладачів…</p>
      ) : (
        <SelectField
          label="Викладач курсу"
          name="course-teacher"
          value={choice}
          options={options}
          onChange={(event) => {
            setChoice(event.target.value);
            assign.reset();
          }}
        />
      )}
      <button type="submit" className="btnSteel" disabled={unchanged || assign.isPending}>
        {assign.isPending ? 'Зберігаємо…' : 'Призначити'}
      </button>
      {teachers.error && <FormError message="Не вдалося завантажити список викладачів" />}
      <FormError message={generalError(assign.error)} />
      {assign.isSuccess && (
        <p className={styles.ok} role="status">
          Викладача призначено
        </p>
      )}
    </form>
  );
}
