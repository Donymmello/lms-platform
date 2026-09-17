import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { AnalyticsOverview, CourseAnalytics, RevenueSeries } from "@/types/analytics";

/**
 * Reporting endpoints. All three are ADMIN/INSTRUCTOR-only — a STUDENT hitting
 * them gets a 403, and an instructor only ever receives their own courses.
 */
export const analyticsService = {
  async getOverview(): Promise<AnalyticsOverview> {
    const res = await apiFetch<ApiSuccessResponse<AnalyticsOverview>>("/analytics/overview");
    return res.data;
  },

  async getRevenueSeries(days = 30): Promise<RevenueSeries> {
    const res = await apiFetch<ApiSuccessResponse<RevenueSeries>>("/analytics/revenue", { query: { days } });
    return res.data;
  },

  async getCourseBreakdown(): Promise<CourseAnalytics[]> {
    const res = await apiFetch<ApiSuccessResponse<{ courses: CourseAnalytics[] }>>("/analytics/courses");
    return res.data.courses;
  },
};
