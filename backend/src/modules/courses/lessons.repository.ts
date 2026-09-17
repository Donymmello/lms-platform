import { Lesson } from "@prisma/client";
import { prisma } from "../../database/prisma";

export const lessonsRepository = {
  findById(id: string): Promise<Lesson | null> {
    return prisma.lesson.findUnique({ where: { id } });
  },

  async nextOrder(moduleId: string): Promise<number> {
    const last = await prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (last?.order ?? -1) + 1;
  },

  create(data: {
    title: string;
    description: string;
    isFreePreview: boolean;
    moduleId: string;
    order: number;
  }): Promise<Lesson> {
    return prisma.lesson.create({ data });
  },

  update(
    id: string,
    data: Partial<{ title: string; description: string; isFreePreview: boolean; order: number }>
  ): Promise<Lesson> {
    return prisma.lesson.update({ where: { id }, data });
  },

  delete(id: string): Promise<Lesson> {
    return prisma.lesson.delete({ where: { id } });
  },

  setVideo(id: string, bunnyVideoId: string | null): Promise<Lesson> {
    return prisma.lesson.update({ where: { id }, data: { bunnyVideoId } });
  },
};
