export type Level = 'beginner' | 'intermediate' | 'advanced';
export type StreamPhase = 'upcoming' | 'running' | 'finished';

export interface Topic {
  id: number;
  name: string;
}

export interface TeacherRef {
  id: number;
  name: string;
}

export interface CourseSummary {
  id: number;
  title: string;
  description: string;
  level: Level;
  language: string;
  teacher: TeacherRef | null;
  topics: string[];
  lessonCount: number;
}

export interface CourseList {
  items: CourseSummary[];
  nextCursor: string | null;
}

export interface LessonOutline {
  id: number;
  position: number;
  title: string;
  isFreeIntro: boolean;
  hasHomework: boolean;
}

export interface StreamInfo {
  id: number;
  title: string;
  startsOn: string;
  endsOn: string;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  phase: StreamPhase;
}

export interface CoursePage {
  id: number;
  title: string;
  description: string;
  level: Level;
  language: string;
  status: 'draft' | 'published';
  sequentialLessons: boolean;
  teacher: { id: number; name: string; bio: string | null } | null;
  topics: Topic[];
  lessons: LessonOutline[];
  streams: StreamInfo[];
}

export interface Material {
  id: number;
  title: string;
  kind: 'video' | 'article' | 'file' | 'link';
  url: string;
}

export interface IntroLesson {
  id: number;
  position: number;
  title: string;
  content: string;
  materials: Material[];
}
