import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { CourseDetail, ListCoursesParams, PaginatedCourses } from "@/types/course";

export const publicCoursesService = {
  async list(params: Pick<ListCoursesParams, "page" | "pageSize" | "search">): Promise<PaginatedCourses> {
    const res = await apiFetch<ApiSuccessResponse<PaginatedCourses>>("/public/courses", {
      query: { page: params.page, pageSize: params.pageSize, search: params.search },
    });
    return res.data;
  },

  async getBySlug(slug: string): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(`/public/courses/${slug}`);
    return res.data.course;
  },
};
