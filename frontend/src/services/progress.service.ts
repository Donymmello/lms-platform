import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { CourseProgress, CourseProgressSummary } from "@/types/progress";

export const progressService = {
  async getCourseProgress(courseId: string): Promise<CourseProgress> {
    const res = await apiFetch<ApiSuccessResponse<CourseProgress>>(`/progress/courses/${courseId}`);
    return res.data;
  },

  async setLessonComplete(lessonId: string, completed: boolean): Promise<void> {
    await apiFetch<ApiSuccessResponse<{ lessonId: string; completed: boolean }>>(`/progress/lessons/${lessonId}`, {
      method: "PUT",
      body: { completed },
    });
  },

  /**
   * Reports how far the player has got. The server applies the completion
   * threshold, so the caller never has to know what it is.
   */
  async recordPosition(
    lessonId: string,
    positionSeconds: number,
    durationSeconds: number
  ): Promise<{ completed: boolean }> {
    const res = await apiFetch<ApiSuccessResponse<{ completed: boolean }>>(
      `/progress/lessons/${lessonId}/position`,
      { method: "PUT", body: { positionSeconds, durationSeconds } }
    );
    return res.data;
  },

  /** One summary per enrolled course — powers the progress bars on "Os meus cursos". */
  async getMySummary(): Promise<CourseProgressSummary[]> {
    const res = await apiFetch<ApiSuccessResponse<{ courses: CourseProgressSummary[] }>>("/progress/me");
    return res.data.courses;
  },
};
