import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthForm } from '../../components/AuthForm';
import { AuthLayout } from '../../components/AuthLayout';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../features/auth/useAuth';
import { ApiError } from '../../shared/api/client';

type Field = 'name' | 'email' | 'password' | 'confirm';
type Errors = Partial<Record<Field, string>>;

function validate(name: string, password: string, confirm: string): Errors {
  const errors: Errors = {};
  if (name.trim().length < 2) errors.name = 'Щонайменше 2 символи';
  if (password.length < 8) errors.password = 'Щонайменше 8 символів';
  else if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    errors.password = 'Потрібні літера та цифра';
  }
  if (confirm !== password) errors.confirm = 'Паролі не збігаються';
  return errors;
}

function serverErrors(error: unknown): { fields: Errors; general: string } {
  if (!(error instanceof ApiError)) {
    return { fields: {}, general: error ? 'Не вдалося зареєструватися' : '' };
  }
  if (error.code === 'email-taken') {
    return { fields: { email: 'Ця пошта вже зареєстрована' }, general: '' };
  }
  const fields: Errors = {};
  for (const item of error.fieldErrors) {
    const key = item.path.split('.').pop();
    if (key === 'name' || key === 'email' || key === 'password') fields[key] = item.message;
  }
  return { fields, general: Object.keys(fields).length ? '' : error.message };
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [clientErrors, setClientErrors] = useState<Errors>({});

  if (user && !register.isSuccess) return <Navigate to="/courses" replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validate(name, password, confirm);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;
    register.mutate(
      { name: name.trim(), email, password },
      { onSuccess: () => navigate('/courses', { replace: true }) },
    );
  }

  const server = serverErrors(register.error);
  const errors = { ...server.fields, ...clientErrors };

  return (
    <AuthLayout
      title="Реєстрація"
      footer={
        <>
          Уже є обліковий запис? <Link to="/login">Увійти</Link>
        </>
      }
    >
      <AuthForm error={server.general} onSubmit={onSubmit}>
        <TextField
          label="Ім’я"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <TextField
          label="Пошта"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Пароль"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <TextField
          label="Повторіть пароль"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <button type="submit" className="btnSteel" disabled={register.isPending}>
          {register.isPending ? 'Створюємо…' : 'Створити обліковий запис'}
        </button>
      </AuthForm>
    </AuthLayout>
  );
}
