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

export type Role = 'student' | 'teacher' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export type EnrollmentStatus = 'active' | 'completed' | 'cancelled';

export interface Enrollment {
  id: number;
  streamId: number;
  courseId: number;
  status: EnrollmentStatus;
  enrolledAt: string;
}

export interface MyEnrollment extends Enrollment {
  course: { id: number; title: string };
  stream: { id: number; title: string; startsOn: string; endsOn: string };
}

export type CourseStatus = 'draft' | 'published';

export interface OwnCourse {
  id: number;
  title: string;
  description: string;
  language: string;
  level: Level;
  status: CourseStatus;
  sequentialLessons: boolean;
  teacherId: number | null;
  lessonCount: number;
  updatedAt: string;
}

export interface CourseInput {
  title: string;
  description: string;
  language: string;
  level: Level;
  sequentialLessons: boolean;
}

export interface LessonInput {
  title: string;
  content: string;
  isFreeIntro: boolean;
  hasHomework: boolean;
}

export interface OwnStream {
  id: number;
  courseId: number;
  title: string;
  startsOn: string;
  endsOn: string;
  capacity: number;
  seatsTaken: number;
}

export interface StreamInput {
  title: string;
  startsOn: string;
  endsOn: string;
  capacity: number;
}

