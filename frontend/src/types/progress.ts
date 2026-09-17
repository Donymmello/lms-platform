/** Full progress breakdown for one course, from the current user's point of view. */
export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  /** 0–100, rounded. 0 when the course has no lessons yet. */
  percent: number;
  completedLessonIds: string[];
  /** First not-yet-completed lesson in curriculum order; the course's first lesson once everything is done. Null only for an empty course. */
  resumeLessonId: string | null;
}

/** Lightweight per-course summary — one entry per enrollment. */
export interface CourseProgressSummary {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
}
