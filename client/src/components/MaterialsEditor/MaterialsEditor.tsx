import { useDeleteMaterial, useLessonMaterials } from '../../features/teacher/queries';
import { generalError } from '../../shared/lib/formErrors';
import { FileMaterialForm } from '../FileMaterialForm';
import { FormError } from '../FormError';
import { LinkMaterialForm } from '../LinkMaterialForm';
import { Loading } from '../Loading';
import styles from './MaterialsEditor.module.css';

const KIND_LABEL: Record<string, string> = {
  video: 'Відео',
  article: 'Стаття',
  file: 'Файл',
  link: 'Посилання',
};

export function MaterialsEditor({ lessonId }: { lessonId: number }) {
  const materials = useLessonMaterials(lessonId);
  const remove = useDeleteMaterial(lessonId);

  return (
    <section className={`glassPanel ${styles.panel}`}>
      <h2 className={`fontDisplay ${styles.title}`}>Матеріали уроку</h2>
      <FormError message={generalError(remove.error)} />

      {materials.isPending && <Loading />}
      {materials.data && materials.data.items.length === 0 && (
        <p className={styles.empty}>Матеріалів поки немає.</p>
      )}
      {materials.data && materials.data.items.length > 0 && (
        <ul className={styles.list}>
          {materials.data.items.map((m) => (
            <li key={m.id} className={styles.item}>
              <div className={styles.info}>
                <a
                  href={m.url}
                  className={styles.link}
                  target={m.fileName ? undefined : '_blank'}
                  rel="noreferrer"
                >
                  {m.title}
                </a>
                <span className={styles.muted}>
                  {KIND_LABEL[m.kind] ?? m.kind}
                  {m.fileName && `, ${m.fileName}`}
                </span>
              </div>
              <button
                type="button"
                className="btnGhost btnSm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(m.id)}
              >
                Видалити
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.forms}>
        <LinkMaterialForm lessonId={lessonId} />
        <FileMaterialForm lessonId={lessonId} />
      </div>
    </section>
  );
}
