import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../shared/api/client';
import type { User } from '../../shared/api/types';

const ME_KEY = ['me'] as const;

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody extends LoginBody {
  name: string;
}

function resetSession(qc: QueryClient, user: User | null): void {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
  qc.setQueryData(ME_KEY, user);
}

export function useAuth() {
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await api<User>('/auth/me', { signal });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const login = useMutation({
    mutationFn: (body: LoginBody) => api<User>('/auth/login', { method: 'POST', body }),
    onSuccess: (user) => resetSession(qc, user),
  });

  const register = useMutation({
    mutationFn: (body: RegisterBody) => api<User>('/auth/register', { method: 'POST', body }),
    onSuccess: (user) => resetSession(qc, user),
  });

  const logout = useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => resetSession(qc, null),
  });

  const logoutAll = useMutation({
    mutationFn: () => api<void>('/auth/logout-all', { method: 'POST' }),
    onSettled: () => resetSession(qc, null),
  });

  return {
    user: me.data ?? null,
    loading: me.isPending,
    login,
    register,
    logout,
    logoutAll,
  };
}
