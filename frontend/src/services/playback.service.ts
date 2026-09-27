import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { SignedPlayback } from "@/types/playback";

export const playbackService = {
  /**
   * Asks where a lesson's video can be played from. The backend decides
   * access on every call (free preview / owner / enrolled) — a 403 here
   * means "not enrolled", a 404 means "no video yet" or the lesson/course
   * doesn't exist, both of which the caller handles explicitly.
   */
  async getSignedUrl(lessonId: string): Promise<SignedPlayback> {
    const res = await apiFetch<ApiSuccessResponse<SignedPlayback>>(`/lessons/${lessonId}/playback`);
    return res.data;
  },
};
