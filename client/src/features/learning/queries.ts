import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { CourseProgress, LessonView, ProgressSummary } from '../../shared/api/types';

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
