export interface LiveSessionDto {
  id: string;
  courseId: string;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  /**
   * The meeting link. Present only for someone entitled to attend — see
   * live-sessions.service.ts. Null means "you can see it is scheduled, but
   * not how to get in".
   */
  joinUrl: string | null;
  /** True once the session has started and has not yet run past its duration. */
  isLive: boolean;
}
