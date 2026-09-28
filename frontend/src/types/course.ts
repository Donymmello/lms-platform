export type CourseStatus = "DRAFT" | "PUBLISHED";

export interface CourseInstructor {
  id: string;
  name: string;
}

/** A downloadable attached to a lesson. The bytes come from an access-checked route. */
export interface LessonMaterial {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface LessonItem {
  id: string;
  title: string;
  description: string;
  order: number;
  isFreePreview: boolean;
  durationSeconds: number | null;
  hasVideo: boolean;
  materials: LessonMaterial[];
}

/** That the module has an end-of-module quiz, and how big it is — never the questions. */
export interface ModuleAssessmentSummary {
  title: string;
  questionCount: number;
}

export interface CourseModuleItem {
  id: string;
  title: string;
  order: number;
  lessons: LessonItem[];
  assessment: ModuleAssessmentSummary | null;
}

export interface CourseListItem {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  priceCents: number;
  thumbnailUrl: string | null;
  instructor: CourseInstructor;
  moduleCount: number;
  createdAt: string;
}

export interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  priceCents: number;
  thumbnailUrl: string | null;
  instructor: CourseInstructor;
  modules: CourseModuleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedCourses {
  courses: CourseListItem[];
  pagination: Pagination;
}

export interface ListCoursesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CourseStatus;
}
