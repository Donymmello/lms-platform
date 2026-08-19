import { CourseStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import {
  CourseWithDetailRelations,
  CourseWithListRelations,
  detailInclude,
  listInclude,
} from "../courses/courses.repository";
import { ListPublicCoursesQuery } from "./schemas/public-course.schema";

function buildWhere(query: Pick<ListPublicCoursesQuery, "search">): Prisma.CourseWhereInput {
  return {
    // The public catalog only ever surfaces published courses — this is not
    // a query parameter, it's a hard constraint of this module.
    status: CourseStatus.PUBLISHED,
    ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
  };
}

export const publicCoursesRepository = {
  async findMany(
    query: ListPublicCoursesQuery
  ): Promise<{ courses: CourseWithListRelations[]; total: number }> {
    const where = buildWhere(query);

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

  findPublishedBySlug(slug: string): Promise<CourseWithDetailRelations | null> {
    return prisma.course.findFirst({
      where: { slug, status: CourseStatus.PUBLISHED },
      include: detailInclude,
    });
  },
};
