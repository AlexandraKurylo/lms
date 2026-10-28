import type { components } from './schema';

type Schemas = components['schemas'];

export type Level = Schemas['Level'];
export type Role = Schemas['Role'];
export type Topic = Schemas['Topic'];
export type TeacherRef = Schemas['TeacherRef'];
export type User = Schemas['User'];

export type CourseSummary = Schemas['CourseSummary'];
export type CourseList = Schemas['CourseList'];
export type LessonOutline = Schemas['LessonOutline'];
export type StreamInfo = Schemas['StreamInfo'];
export type StreamPhase = StreamInfo['phase'];
export type CoursePage = Schemas['CoursePage'];
export type Material = Schemas['Material'];
export type IntroLesson = Schemas['IntroLesson'];

export type Enrollment = Schemas['Enrollment'];
export type EnrollmentStatus = Enrollment['status'];
export type MyEnrollment = Schemas['MyEnrollment'];

export type OwnCourse = Schemas['OwnCourse'];
export type CourseStatus = OwnCourse['status'];
export type OwnStream = Schemas['OwnStream'];
export type OwnLesson = Schemas['OwnLesson'];

export type CourseInput = Required<Schemas['CourseInput']>;
export type LessonInput = Required<Schemas['LessonInput']>;
export type StreamInput = Schemas['StreamInput'];
export type LinkMaterialInput = Schemas['CreateLinkMaterialRequest'];
export type GradeInput = Schemas['GradeRequest'];

export type ProgressSummary = Schemas['ProgressSummary'];
export type CourseProgress = Schemas['CourseProgress'];
export type LessonProgressItem = CourseProgress['lessons'][number];
export type LessonView = Schemas['LessonView'];
export type Submission = Schemas['Submission'];

export type StreamStudent = Schemas['StreamStudent'];
export type StreamSubmission = Schemas['StreamSubmission'];

export type SubmissionFilter = 'all' | 'pending' | 'graded';
