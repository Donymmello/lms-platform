import { LiveSession, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

export const liveSessionsRepository = {
  findManyForCourse(courseId: string): Promise<LiveSession[]> {
    return prisma.liveSession.findMany({
      where: { courseId },
      orderBy: { startsAt: "asc" },
    });
  },

  findById(id: string): Promise<LiveSession | null> {
    return prisma.liveSession.findUnique({ where: { id } });
  },

  create(courseId: string, data: Prisma.LiveSessionCreateWithoutCourseInput): Promise<LiveSession> {
    return prisma.liveSession.create({ data: { ...data, course: { connect: { id: courseId } } } });
  },

  update(id: string, data: Prisma.LiveSessionUpdateInput): Promise<LiveSession> {
    return prisma.liveSession.update({ where: { id }, data });
  },

  delete(id: string): Promise<LiveSession> {
    return prisma.liveSession.delete({ where: { id } });
  },
};
