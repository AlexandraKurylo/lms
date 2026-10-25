import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type {
  CourseInput,
  CourseStatus,
  GradeInput,
  LinkMaterialInput,
  Material,
  LessonInput,
  OwnCourse,
  OwnLesson,
  OwnStream,
  StreamInput,
  StreamStudent,
  StreamSubmission,
  SubmissionFilter,
} from '../../shared/api/types';

const coursesKey = ['teacher', 'courses'] as const;
const courseKey = (id: number) => ['teacher', 'course', id] as const;
const streamsKey = (id: number) => ['teacher', 'streams', id] as const;
const lessonKey = (id: number) => ['teacher', 'lesson', id] as const;

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
    void qc.invalidateQueries({ queryKey: ['teacher', 'lesson'] });
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

export function useOwnLesson(id: number) {
  return useQuery({
    queryKey: lessonKey(id),
    queryFn: ({ signal }) => api<OwnLesson>(`/teacher/lessons/${id}`, { signal }),
    retry: false,
  });
}

export function useUpdateLesson(id: number, courseId: number) {
  const invalidate = useInvalidate(courseId);
  return useMutation({
    mutationFn: (body: Partial<LessonInput>) =>
      api<OwnLesson>(`/teacher/lessons/${id}`, { method: 'PATCH', body }),
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

export function useOwnStream(id: number) {
  return useQuery({
    queryKey: ['teacher', 'stream', id] as const,
    queryFn: ({ signal }) => api<OwnStream>(`/teacher/streams/${id}`, { signal }),
    retry: false,
  });
}

export function useStreamStudents(streamId: number) {
  return useQuery({
    queryKey: ['teacher', 'stream-students', streamId] as const,
    queryFn: ({ signal }) =>
      api<{ items: StreamStudent[] }>(`/teacher/streams/${streamId}/students`, { signal }),
  });
}

export function useStreamSubmissions(streamId: number, status: SubmissionFilter) {
  return useQuery({
    queryKey: ['teacher', 'stream-submissions', streamId, status] as const,
    queryFn: ({ signal }) =>
      api<{ items: StreamSubmission[] }>(
        `/teacher/streams/${streamId}/submissions?status=${status}`,
        { signal },
      ),
  });
}

export function useGradeSubmission(streamId: number, submissionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GradeInput) =>
      api<StreamSubmission>(`/teacher/submissions/${submissionId}/grade`, { method: 'PUT', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher', 'stream-submissions', streamId] });
      void qc.invalidateQueries({ queryKey: ['teacher', 'stream-students', streamId] });
    },
  });
}

const materialsKey = (lessonId: number) => ['teacher', 'materials', lessonId] as const;

export function useLessonMaterials(lessonId: number) {
  return useQuery({
    queryKey: materialsKey(lessonId),
    queryFn: ({ signal }) =>
      api<{ items: Material[] }>(`/teacher/lessons/${lessonId}/materials`, { signal }),
  });
}

export function useAddMaterialLink(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LinkMaterialInput) =>
      api<Material>(`/teacher/lessons/${lessonId}/materials`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: materialsKey(lessonId) }),
  });
}

export function useAddMaterialFile(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title: string }) =>
      api<Material>(`/teacher/lessons/${lessonId}/materials/file`, {
        method: 'PUT',
        file,
        headers: title ? { 'X-Material-Title': encodeURIComponent(title) } : undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: materialsKey(lessonId) }),
  });
}

export function useDeleteMaterial(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/teacher/materials/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: materialsKey(lessonId) }),
  });
}
