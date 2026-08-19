import { NotFoundError } from "../../errors";
import { toDetailDto, toListItemDto } from "../courses/courses.service";
import { CourseDetailDto, PaginatedCoursesDto } from "../courses/dtos/course.dto";
import { publicCoursesRepository } from "./public-courses.repository";
import { ListPublicCoursesQuery } from "./schemas/public-course.schema";

export const publicCoursesService = {
  async list(query: ListPublicCoursesQuery): Promise<PaginatedCoursesDto> {
    const { courses, total } = await publicCoursesRepository.findMany(query);

    return {
      courses: courses.map(toListItemDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  },

  async getBySlug(slug: string): Promise<CourseDetailDto> {
    const course = await publicCoursesRepository.findPublishedBySlug(slug);
    if (!course) {
      throw new NotFoundError("Course not found");
    }
    return toDetailDto(course);
  },
};
