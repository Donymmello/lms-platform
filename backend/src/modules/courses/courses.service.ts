import { Course, Role } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../errors";
import { slugify } from "../../utils/slugify";
import { enrollmentsRepository } from "../enrollments/enrollments.repository";
import { AuthenticatedUser } from "../../@types/express";
import {
  CourseDetailDto,
  CourseListItemDto,
  LessonResponseDto,
  PaginatedCoursesDto,
} from "./dtos/course.dto";
import { CreateCourseInput, ListCoursesQuery, UpdateCourseInput, UpdateCourseStatusInput } from "./schemas/course.schema";
import {
  coursesRepository,
  CourseWithDetailRelations,
  CourseWithListRelations,
} from "./courses.repository";

function toListItemDto(course: CourseWithListRelations): CourseListItemDto {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    status: course.status,
    priceCents: course.priceCents,
    thumbnailUrl: course.thumbnailUrl,
    instructor: course.instructor,
    moduleCount: course._count.modules,
    createdAt: course.createdAt,
  };
}

function toLessonDto(lesson: CourseWithDetailRelations["modules"][number]["lessons"][number]): LessonResponseDto {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    order: lesson.order,
    isFreePreview: lesson.isFreePreview,
    durationSeconds: lesson.durationSeconds,
    hasVideo: Boolean(lesson.bunnyVideoId),
    // Names and sizes only — the bytes go through their own access-checked
    // route, exactly like the video does.
    materials: lesson.materials.map((material) => ({
      id: material.id,
      fileName: material.fileName,
      contentType: material.contentType,
      sizeBytes: material.sizeBytes,
    })),
  };
}

function toDetailDto(course: CourseWithDetailRelations): CourseDetailDto {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    status: course.status,
    priceCents: course.priceCents,
    thumbnailUrl: course.thumbnailUrl,
    instructor: course.instructor,
    modules: course.modules.map((courseModule: CourseWithDetailRelations["modules"][number]) => ({
      id: courseModule.id,
      title: courseModule.title,
      order: courseModule.order,
      lessons: courseModule.lessons.map(toLessonDto),
      assessment: courseModule.assessment
        ? {
            title: courseModule.assessment.title,
            questionCount: courseModule.assessment._count.questions,
          }
        : null,
    })),
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

/** ADMIN can touch any course; an INSTRUCTOR only their own. */
function assertCanManage(course: Pick<Course, "instructorId">, actingUser: AuthenticatedUser): void {
  if (actingUser.role !== Role.ADMIN && course.instructorId !== actingUser.id) {
    throw new ForbiddenError("You do not have permission to manage this course");
  }
}

/**
 * Course-level content access: an ADMIN, or the INSTRUCTOR who owns the
 * course, always passes; anyone else has to actually be enrolled. Shared so
 * every feature hanging off a course enforces one rule instead of each
 * re-deriving its own.
 */
async function assertCanAccessCourse(
  course: Pick<Course, "id" | "instructorId">,
  actingUser: AuthenticatedUser,
  forbiddenMessage: string
): Promise<void> {
  if (actingUser.role === Role.ADMIN) return;
  if (actingUser.role === Role.INSTRUCTOR && course.instructorId === actingUser.id) return;

  const enrollment = await enrollmentsRepository.findByUserAndCourse(actingUser.id, course.id);
  if (!enrollment) {
    throw new ForbiddenError(forbiddenMessage);
  }
}

async function requireCourse(id: string): Promise<Course> {
  const course = await coursesRepository.findById(id);
  if (!course) {
    throw new NotFoundError("Course not found");
  }
  return course;
}

async function requireCourseWithContent(id: string): Promise<CourseWithDetailRelations> {
  const course = await coursesRepository.findByIdWithContent(id);
  if (!course) {
    throw new NotFoundError("Course not found");
  }
  return course;
}

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "course";
  let candidate = base;
  let suffix = 2;

  while (await coursesRepository.findBySlug(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export const coursesService = {
  async list(query: ListCoursesQuery, actingUser: AuthenticatedUser): Promise<PaginatedCoursesDto> {
    const filter = actingUser.role === Role.ADMIN ? {} : { instructorId: actingUser.id };
    const { courses, total } = await coursesRepository.findMany(query, filter);

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

  async getById(id: string, actingUser: AuthenticatedUser): Promise<CourseDetailDto> {
    const course = await requireCourseWithContent(id);
    assertCanManage(course, actingUser);
    return toDetailDto(course);
  },

  async create(input: CreateCourseInput, actingUser: AuthenticatedUser): Promise<CourseDetailDto> {
    const slug = await generateUniqueSlug(input.title);

    const created = await coursesRepository.create({
      title: input.title,
      slug,
      description: input.description,
      thumbnailUrl: input.thumbnailUrl,
      priceCents: input.priceCents,
      instructorId: actingUser.id,
    });

    return toDetailDto(await requireCourseWithContent(created.id));
  },

  async update(id: string, input: UpdateCourseInput, actingUser: AuthenticatedUser): Promise<CourseDetailDto> {
    const course = await requireCourse(id);
    assertCanManage(course, actingUser);

    await coursesRepository.update(id, input);
    return toDetailDto(await requireCourseWithContent(id));
  },

  async updateStatus(
    id: string,
    input: UpdateCourseStatusInput,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(id);
    assertCanManage(course, actingUser);

    await coursesRepository.updateStatus(id, input.status);
    return toDetailDto(await requireCourseWithContent(id));
  },

  async remove(id: string, actingUser: AuthenticatedUser): Promise<void> {
    const course = await requireCourse(id);
    assertCanManage(course, actingUser);
    await coursesRepository.delete(id);
  },
};

export {
  assertCanAccessCourse,
  assertCanManage,
  requireCourse,
  requireCourseWithContent,
  toDetailDto,
  toListItemDto,
};
