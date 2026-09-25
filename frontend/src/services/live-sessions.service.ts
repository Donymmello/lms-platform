import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { LiveSession, LiveSessionInput } from "@/types/live-session";

/**
 * Live classes are scheduled by the instructor and gated by enrolment — the
 * backend withholds `joinUrl` from anyone not entitled to attend, so the
 * frontend never has to decide who may see a meeting link.
 */
export const liveSessionsService = {
  async listForCourse(courseId: string): Promise<LiveSession[]> {
    const res = await apiFetch<ApiSuccessResponse<{ sessions: LiveSession[] }>>(
      `/live-sessions/courses/${courseId}`
    );
    return res.data.sessions;
  },

  async create(courseId: string, input: LiveSessionInput): Promise<LiveSession> {
    const res = await apiFetch<ApiSuccessResponse<{ session: LiveSession }>>(
      `/live-sessions/courses/${courseId}`,
      { method: "POST", body: input }
    );
    return res.data.session;
  },

  async update(sessionId: string, input: Partial<LiveSessionInput>): Promise<LiveSession> {
    const res = await apiFetch<ApiSuccessResponse<{ session: LiveSession }>>(
      `/live-sessions/${sessionId}`,
      { method: "PATCH", body: input }
    );
    return res.data.session;
  },

  async remove(sessionId: string): Promise<void> {
    await apiFetch<null>(`/live-sessions/${sessionId}`, { method: "DELETE" });
  },
};
