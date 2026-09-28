import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import {
  AssessmentDraft,
  AssessmentForEditing,
  AssessmentForTaking,
  AttemptResult,
} from "@/types/assessment";

export const assessmentsService = {
  /** The taking shape — questions and options, and nothing about which is right. */
  async getForTaking(moduleId: string): Promise<AssessmentForTaking> {
    const res = await apiFetch<ApiSuccessResponse<{ assessment: AssessmentForTaking }>>(
      `/modules/${moduleId}/assessment`
    );
    return res.data.assessment;
  },

  /** The editing shape, with the answer key. Owner or admin only; anyone else gets a 403. */
  async getForEditing(moduleId: string): Promise<AssessmentForEditing> {
    const res = await apiFetch<ApiSuccessResponse<{ assessment: AssessmentForEditing }>>(
      `/modules/${moduleId}/assessment/edit`
    );
    return res.data.assessment;
  },

  /** Creates or replaces the module's assessment whole. */
  async save(moduleId: string, draft: AssessmentDraft): Promise<AssessmentForEditing> {
    const res = await apiFetch<ApiSuccessResponse<{ assessment: AssessmentForEditing }>>(
      `/modules/${moduleId}/assessment`,
      { method: "PUT", body: draft }
    );
    return res.data.assessment;
  },

  async remove(moduleId: string): Promise<void> {
    await apiFetch(`/modules/${moduleId}/assessment`, { method: "DELETE" });
  },

  async submitAttempt(
    moduleId: string,
    answers: { questionId: string; selectedOptionIds: string[] }[]
  ): Promise<AttemptResult> {
    const res = await apiFetch<ApiSuccessResponse<{ result: AttemptResult }>>(
      `/modules/${moduleId}/assessment/attempts`,
      { method: "POST", body: { answers } }
    );
    return res.data.result;
  },
};
