import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type {
  CourseInput,
  CourseStatus,
  LessonInput,
  OwnCourse,
  OwnStream,
  StreamInput,
} from '../../shared/api/types';

const coursesKey = ['teacher', 'courses'] as const;
const courseKey = (id: number) => ['teacher', 'course', id] as const;
const streamsKey = (id: number) => ['teacher', 'streams', id] as const;

export function useOwnCourses() {
  return useQuery({
    queryKey: coursesKey,
    queryFn: ({ signal }) => api<{ items: OwnCourse[] }>('/teacher/courses', { signal }),
  });
}

export function useOwnCourse(id: number) {
  return useQuery({
    queryKey: courseKey(id),
    queryFn: ({ signal }) => api<OwnCourse>(`/teacher/courses/${id}`, { signal }),
    retry: false,
  });
}

export function useOwnStreams(courseId: number) {
  return useQuery({
    queryKey: streamsKey(courseId),
    queryFn: ({ signal }) =>
      api<{ items: OwnStream[] }>(`/teacher/courses/${courseId}/streams`, { signal }),
  });
}

function useInvalidate(courseId?: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: coursesKey });
    if (courseId === undefined) return;
    void qc.invalidateQueries({ queryKey: courseKey(courseId) });
    void qc.invalidateQueries({ queryKey: streamsKey(courseId) });
    void qc.invalidateQueries({ queryKey: ['course', courseId] });
  };
}

export function useCreateCourse() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CourseInput) => api<OwnCourse>('/teacher/courses', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateCourse(id: number) {
  const invalidate = useInvalidate(id);
  return useMutation({
    mutationFn: (body: Partial<CourseInput>) =>
      api<OwnCourse>(`/teacher/courses/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useAddLesson(courseId: number) {
  const invalidate = useInvalidate(courseId);
  return useMutation({
    mutationFn: (body: LessonInput) =>
      api<{ id: number; position: number }>(`/teacher/courses/${courseId}/lessons`, {
        method: 'POST',
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useCreateStream(courseId: number) {
  const invalidate = useInvalidate(courseId);
  return useMutation({
    mutationFn: (body: StreamInput) =>
      api<OwnStream>(`/teacher/courses/${courseId}/streams`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateStream(courseId: number, streamId: number) {
  const invalidate = useInvalidate(courseId);
  return useMutation({
    mutationFn: (body: StreamInput) =>
      api<OwnStream>(`/teacher/streams/${streamId}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useSetCourseStatus(courseId: number) {
  const invalidate = useInvalidate(courseId);
  return useMutation({
    mutationFn: (status: CourseStatus) =>
      api<{ id: number; status: CourseStatus }>(`/admin/courses/${courseId}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: invalidate,
  });
}
