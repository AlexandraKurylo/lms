import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthForm } from '../../components/AuthForm';
import { AuthLayout } from '../../components/AuthLayout';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../features/auth/useAuth';
import { ApiError } from '../../shared/api/client';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/courses';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user && !login.isSuccess) return <Navigate to={from} replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) });
  }

  const message =
    login.error instanceof ApiError ? login.error.message : login.error ? 'Не вдалося увійти' : '';

  return (
    <AuthLayout
      title="Вхід"
      footer={
        <>
          Немає облікового запису? <Link to="/register">Зареєструватися</Link>
        </>
      }
    >
      <AuthForm error={message} onSubmit={onSubmit}>
        <TextField
          label="Пошта"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Пароль"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btnSteel" disabled={login.isPending}>
          {login.isPending ? 'Входимо…' : 'Увійти'}
        </button>
      </AuthForm>
    </AuthLayout>
  );
}
