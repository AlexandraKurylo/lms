import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { AdminStream, AdminTeacher, StreamReport } from '../../shared/api/types';

export function useTeachers() {
  return useQuery({
    queryKey: ['admin', 'teachers'] as const,
    queryFn: ({ signal }) => api<{ items: AdminTeacher[] }>('/admin/teachers', { signal }),
  });
}

export function useAllStreams() {
  return useQuery({
    queryKey: ['admin', 'streams'] as const,
    queryFn: ({ signal }) => api<{ items: AdminStream[] }>('/admin/streams', { signal }),
  });
}

export function useStreamReport(streamId: number | null) {
  return useQuery({
    queryKey: ['admin', 'report', streamId] as const,
    queryFn: ({ signal }) => api<StreamReport>(`/admin/streams/${streamId}/report`, { signal }),
    enabled: streamId !== null,
    retry: false,
  });
}

export function useAssignTeacher(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teacherId: number) =>
      api<{ id: number; teacherId: number }>(`/admin/courses/${courseId}/teacher`, {
        method: 'PATCH',
        body: { teacherId },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher'] });
      void qc.invalidateQueries({ queryKey: ['course', courseId] });
      void qc.invalidateQueries({ queryKey: ['courses'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'report'] });
    },
  });
}
