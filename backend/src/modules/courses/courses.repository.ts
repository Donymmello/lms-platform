import { Course, CourseStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { ListCoursesQuery } from "./schemas/course.schema";

export interface CourseFilter {
  /** Restricts results to one instructor's courses — used for the INSTRUCTOR role. */
  instructorId?: string;
}

function buildWhere(
  query: Pick<ListCoursesQuery, "search" | "status">,
  filter: CourseFilter
): Prisma.CourseWhereInput {
  return {
    ...(filter.instructorId ? { instructorId: filter.instructorId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
  };
}

export const listInclude = {
  instructor: { select: { id: true, name: true } },
  _count: { select: { modules: true } },
} satisfies Prisma.CourseInclude;

export const detailInclude = {
  instructor: { select: { id: true, name: true } },
  modules: {
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  },
} satisfies Prisma.CourseInclude;

export type CourseWithListRelations = Prisma.CourseGetPayload<{ include: typeof listInclude }>;
export type CourseWithDetailRelations = Prisma.CourseGetPayload<{ include: typeof detailInclude }>;

export const coursesRepository = {
  async findMany(
    query: ListCoursesQuery,
    filter: CourseFilter
  ): Promise<{ courses: CourseWithListRelations[]; total: number }> {
    const where = buildWhere(query, filter);

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.course.count({ where }),
    ]);

    return { courses, total };
  },

  findByIdWithContent(id: string): Promise<CourseWithDetailRelations | null> {
    return prisma.course.findUnique({ where: { id }, include: detailInclude });
  },

  findById(id: string): Promise<Course | null> {
    return prisma.course.findUnique({ where: { id } });
  },

  findBySlug(slug: string): Promise<Course | null> {
    return prisma.course.findUnique({ where: { slug } });
  },

  create(data: {
    title: string;
    slug: string;
    description: string;
    thumbnailUrl?: string;
    priceCents: number;
    instructorId: string;
  }): Promise<Course> {
    return prisma.course.create({ data });
  },

  update(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      thumbnailUrl: string | null;
      priceCents: number;
    }>
  ): Promise<Course> {
    return prisma.course.update({ where: { id }, data });
  },

  updateStatus(id: string, status: CourseStatus): Promise<Course> {
    return prisma.course.update({ where: { id }, data: { status } });
  },

  delete(id: string): Promise<Course> {
    return prisma.course.delete({ where: { id } });
  },
};
