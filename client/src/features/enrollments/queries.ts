import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Enrollment, MyEnrollment } from '../../shared/api/types';

const MINE_KEY = ['my-enrollments'] as const;

export function useMyEnrollments(enabled = true) {
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: ({ signal }) => api<{ items: MyEnrollment[] }>('/me/enrollments', { signal }),
    enabled,
  });
}

function useRefreshAfter(courseId?: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: MINE_KEY });
    if (courseId !== undefined) void qc.invalidateQueries({ queryKey: ['course', courseId] });
  };
}

export function useEnroll(courseId: number) {
  const refresh = useRefreshAfter(courseId);
  return useMutation({
    mutationFn: (streamId: number) =>
      api<Enrollment>(`/streams/${streamId}/enrollments`, { method: 'POST' }),
    onSettled: refresh,
  });
}

export function useCancelEnrollment(courseId?: number) {
  const refresh = useRefreshAfter(courseId);
  return useMutation({
    mutationFn: (enrollmentId: number) =>
      api<void>(`/me/enrollments/${enrollmentId}`, { method: 'DELETE' }),
    onSettled: refresh,
  });
}
