import { CourseStatus } from "@prisma/client";

export interface LessonResponseDto {
  id: string;
  title: string;
  description: string;
  order: number;
  isFreePreview: boolean;
  durationSeconds: number | null;
  /// Never expose Bunny's raw video id/URL beyond what's needed to know a
  /// video is attached — actual playback goes through a signed-URL endpoint
  /// once the video module is wired up.
  hasVideo: boolean;
}

export interface CourseModuleResponseDto {
  id: string;
  title: string;
  order: number;
  lessons: LessonResponseDto[];
}

export interface CourseInstructorDto {
  id: string;
  name: string;
}

/** Lightweight shape for list views — no nested modules/lessons. */
export interface CourseListItemDto {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  priceCents: number;
  thumbnailUrl: string | null;
  instructor: CourseInstructorDto;
  moduleCount: number;
  createdAt: Date;
}

/** Full shape for the course detail/edit view — includes the content tree. */
export interface CourseDetailDto {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  priceCents: number;
  thumbnailUrl: string | null;
  instructor: CourseInstructorDto;
  modules: CourseModuleResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedCoursesDto {
  courses: CourseListItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
