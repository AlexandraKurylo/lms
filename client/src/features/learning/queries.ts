import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type {
  CourseProgress,
  LessonView,
  ProgressSummary,
  Submission,
} from '../../shared/api/types';

const progressKey = (courseId: number) => ['learning', 'progress', courseId] as const;
const lessonKey = (id: number) => ['learning', 'lesson', id] as const;

export function useCourseProgress(courseId: number) {
  return useQuery({
    queryKey: progressKey(courseId),
    queryFn: ({ signal }) => api<CourseProgress>(`/me/courses/${courseId}/progress`, { signal }),
    retry: false,
  });
}

export function useLesson(id: number) {
  return useQuery({
    queryKey: lessonKey(id),
    queryFn: ({ signal }) => api<LessonView>(`/lessons/${id}`, { signal }),
    retry: false,
  });
}

export function useSetLessonDone(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (done: boolean) =>
      api<ProgressSummary>(`/lessons/${lessonId}/progress`, { method: done ? 'PUT' : 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning'] });
      void qc.invalidateQueries({ queryKey: ['my-enrollments'] });
    },
  });
}

export function useSubmitHomework(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ comment, file }: { comment: string; file: File | null }) => {
      if (file) {
        await api<Submission>(`/lessons/${lessonId}/submission/file`, { method: 'PUT', file });
      }
      return api<Submission>(`/lessons/${lessonId}/submission`, {
        method: 'PUT',
        body: { comment },
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: lessonKey(lessonId) }),
  });
}

export function useRemoveHomeworkFile(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/lessons/${lessonId}/submission/file`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: lessonKey(lessonId) }),
  });
}
