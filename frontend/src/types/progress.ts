/** Full progress breakdown for one course, from the current user's point of view. */
export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  /** 0–100, rounded. 0 when the course has no lessons yet. */
  percent: number;
  completedLessonIds: string[];
  /** Seconds watched per lesson, for lessons that have been started. A missing entry means zero. */
  lessonPositions: Record<string, number>;
  /** The unfinished lesson last opened; failing that the first not-yet-completed one. Null only for an empty course. */
  resumeLessonId: string | null;
  /** Where to seek in `resumeLessonId`. */
  resumePositionSeconds: number;
}

/** Lightweight per-course summary — one entry per enrollment. */
export interface CourseProgressSummary {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
}
