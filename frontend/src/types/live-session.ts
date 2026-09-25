export interface LiveSession {
  id: string;
  courseId: string;
  title: string;
  description: string;
  /** ISO timestamp. */
  startsAt: string;
  durationMinutes: number;
  /** Null when the viewer is not entitled to join. */
  joinUrl: string | null;
  /** True only while the session is actually running. */
  isLive: boolean;
}

export interface LiveSessionInput {
  title: string;
  description?: string;
  joinUrl: string;
  /** ISO timestamp. */
  startsAt: string;
  durationMinutes?: number;
}
