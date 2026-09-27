/** Detailed progress for one course, from the current user's point of view. */
export interface CourseProgressDto {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  /** 0–100, rounded. 0 when the course has no lessons yet. */
  percent: number;
  completedLessonIds: string[];
  /** Seconds watched per lesson, for lessons that have been started. Absent means zero. */
  lessonPositions: Record<string, number>;
  /** The unfinished lesson the student last opened; failing that, the first not-yet-completed one in curriculum order; the course's first lesson once everything is done (or null if the course has no lessons). */
  resumeLessonId: string | null;
  /** Where to seek in `resumeLessonId`. Zero when it has not been started. */
  resumePositionSeconds: number;
}

/** Lightweight per-course summary — one entry per enrollment, for a "my courses" overview. */
export interface CourseProgressSummaryDto {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
}
