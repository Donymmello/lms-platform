/** Detailed progress for one course, from the current user's point of view. */
export interface CourseProgressDto {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  /** 0–100, rounded. 0 when the course has no lessons yet. */
  percent: number;
  completedLessonIds: string[];
  /** First not-yet-completed lesson in curriculum order; the course's first lesson once everything is done (or if the course has no lessons). */
  resumeLessonId: string | null;
}

/** Lightweight per-course summary — one entry per enrollment, for a "my courses" overview. */
export interface CourseProgressSummaryDto {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
}
