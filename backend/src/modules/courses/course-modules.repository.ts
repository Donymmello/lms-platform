import { CourseModule } from "@prisma/client";
import { prisma } from "../../database/prisma";

export const courseModulesRepository = {
  findById(id: string): Promise<CourseModule | null> {
    return prisma.courseModule.findUnique({ where: { id } });
  },

  async nextOrder(courseId: string): Promise<number> {
    const last = await prisma.courseModule.findFirst({
      where: { courseId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (last?.order ?? -1) + 1;
  },

  create(data: { title: string; courseId: string; order: number }): Promise<CourseModule> {
    return prisma.courseModule.create({ data });
  },

  update(id: string, data: Partial<{ title: string; order: number }>): Promise<CourseModule> {
    return prisma.courseModule.update({ where: { id }, data });
  },

  delete(id: string): Promise<CourseModule> {
    return prisma.courseModule.delete({ where: { id } });
  },
};
