import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { CourseList, CoursePage, IntroLesson, Level, Topic } from '../../shared/api/types';

export interface CatalogFilters {
  q: string;
  level: Level | '';
  topic: number | null;
}

const PAGE_SIZE = 12;

function catalogUrl(filters: CatalogFilters, cursor: string | undefined): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (filters.q) params.set('q', filters.q);
  if (filters.level) params.set('level', filters.level);
  if (filters.topic !== null) params.set('topic', String(filters.topic));
  if (cursor) params.set('cursor', cursor);
  return `/courses?${params.toString()}`;
}

export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: ({ signal }) => api<{ items: Topic[] }>('/topics', { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useCourses(filters: CatalogFilters) {
  return useInfiniteQuery({
    queryKey: ['courses', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api<CourseList>(catalogUrl(filters, pageParam), { signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useCourse(id: number) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: ({ signal }) => api<CoursePage>(`/courses/${id}`, { signal }),
    retry: false,
  });
}

export function useIntroLesson(id: number) {
  return useQuery({
    queryKey: ['course', id, 'intro'],
    queryFn: ({ signal }) => api<IntroLesson>(`/courses/${id}/intro-lesson`, { signal }),
    retry: false,
  });
}
