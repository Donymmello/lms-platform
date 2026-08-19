import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { EnrollmentSummary, MyEnrollment } from "@/types/enrollment";

export const enrollmentsService = {
  async enroll(courseId: string): Promise<EnrollmentSummary> {
    const res = await apiFetch<ApiSuccessResponse<{ enrollment: EnrollmentSummary }>>("/enrollments", {
      method: "POST",
      body: { courseId },
    });
    return res.data.enrollment;
  },

  async listMine(): Promise<MyEnrollment[]> {
    const res = await apiFetch<ApiSuccessResponse<{ enrollments: MyEnrollment[] }>>("/enrollments/me");
    return res.data.enrollments;
  },
};
