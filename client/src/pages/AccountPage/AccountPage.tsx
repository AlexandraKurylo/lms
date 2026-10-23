import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { ROLE_LABEL } from '../../shared/lib/format';
import styles from './AccountPage.module.css';

export function AccountPage() {
  const { user, logout, logoutAll } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  function leave(action: typeof logout | typeof logoutAll) {
    action.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  }

  return (
    <section className={`glassPanel ${styles.card}`}>
      <h1 className={`fontDisplay ${styles.title}`}>Мій обліковий запис</h1>
      <dl className={styles.list}>
        <dt>Ім’я</dt>
        <dd>{user.name}</dd>
        <dt>Пошта</dt>
        <dd>{user.email}</dd>
        <dt>Роль</dt>
        <dd>{ROLE_LABEL[user.role]}</dd>
      </dl>
      <div className={styles.actions}>
        <button type="button" className="btnSteel" onClick={() => leave(logout)}>
          Вийти
        </button>
        <button type="button" className="btnGhost" onClick={() => leave(logoutAll)}>
          Вийти з усіх пристроїв
        </button>
      </div>
    </section>
  );
}
