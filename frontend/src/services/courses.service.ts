import { apiFetch, apiUpload } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { CourseDetail, CourseStatus, ListCoursesParams, PaginatedCourses } from "@/types/course";

type CourseInput = {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  priceCents?: number;
};

function courseResponse(res: ApiSuccessResponse<{ course: CourseDetail }>): CourseDetail {
  return res.data.course;
}

export const coursesService = {
  async list(params: ListCoursesParams): Promise<PaginatedCourses> {
    const res = await apiFetch<ApiSuccessResponse<PaginatedCourses>>("/courses", {
      query: { page: params.page, pageSize: params.pageSize, search: params.search, status: params.status },
    });
    return res.data;
  },

  async getById(courseId: string): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(`/courses/${courseId}`);
    return courseResponse(res);
  },

  async create(input: CourseInput): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>("/courses", {
      method: "POST",
      body: input,
    });
    return courseResponse(res);
  },

  async update(courseId: string, input: Partial<CourseInput>): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(`/courses/${courseId}`, {
      method: "PATCH",
      body: input,
    });
    return courseResponse(res);
  },

  async updateStatus(courseId: string, status: CourseStatus): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(`/courses/${courseId}/status`, {
      method: "PATCH",
      body: { status },
    });
    return courseResponse(res);
  },

  async remove(courseId: string): Promise<void> {
    await apiFetch<null>(`/courses/${courseId}`, { method: "DELETE" });
  },

  async createModule(courseId: string, title: string): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(`/courses/${courseId}/modules`, {
      method: "POST",
      body: { title },
    });
    return courseResponse(res);
  },

  async updateModule(
    courseId: string,
    moduleId: string,
    input: Partial<{ title: string; order: number }>
  ): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}`,
      { method: "PATCH", body: input }
    );
    return courseResponse(res);
  },

  async removeModule(courseId: string, moduleId: string): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}`,
      { method: "DELETE" }
    );
    return courseResponse(res);
  },

  async createLesson(
    courseId: string,
    moduleId: string,
    input: { title: string; isFreePreview?: boolean }
  ): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}/lessons`,
      { method: "POST", body: input }
    );
    return courseResponse(res);
  },

  async updateLesson(
    courseId: string,
    moduleId: string,
    lessonId: string,
    input: Partial<{ title: string; description: string; isFreePreview: boolean; order: number }>
  ): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
      { method: "PATCH", body: input }
    );
    return courseResponse(res);
  },

  async removeLesson(courseId: string, moduleId: string, lessonId: string): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
      { method: "DELETE" }
    );
    return courseResponse(res);
  },

  async uploadLessonVideo(
    courseId: string,
    moduleId: string,
    lessonId: string,
    file: File
  ): Promise<CourseDetail> {
    const formData = new FormData();
    formData.append("video", file);
    const res = await apiUpload<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/video`,
      formData
    );
    return courseResponse(res);
  },

  async addLessonMaterial(
    courseId: string,
    moduleId: string,
    lessonId: string,
    file: File
  ): Promise<CourseDetail> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiUpload<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/materials`,
      formData
    );
    return courseResponse(res);
  },

  async removeLessonMaterial(
    courseId: string,
    moduleId: string,
    lessonId: string,
    materialId: string
  ): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/materials/${materialId}`,
      { method: "DELETE" }
    );
    return courseResponse(res);
  },

  async removeLessonVideo(courseId: string, moduleId: string, lessonId: string): Promise<CourseDetail> {
    const res = await apiFetch<ApiSuccessResponse<{ course: CourseDetail }>>(
      `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/video`,
      { method: "DELETE" }
    );
    return courseResponse(res);
  },
};
