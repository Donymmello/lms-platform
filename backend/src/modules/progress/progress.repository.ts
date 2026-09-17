import { LessonProgress } from "@prisma/client";
import { prisma } from "../../database/prisma";

export const progressRepository = {
  /**
   * Creates or bumps the (user, lesson) row's `lastAccessedAt` (the field's
   * `@updatedAt` does the bumping on any write, even a no-op `update: {}`).
   * Called every time a signed playback URL is issued — see playback.service.ts.
   */
  touchAccess(userId: string, lessonId: string): Promise<LessonProgress> {
    return prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId },
      update: {},
    });
  },

  setCompleted(userId: string, lessonId: string, completed: boolean): Promise<LessonProgress> {
    const completedAt = completed ? new Date() : null;
    return prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, completedAt },
      update: { completedAt },
    });
  },

  async findCompletedLessonIds(userId: string, lessonIds: string[]): Promise<string[]> {
    if (lessonIds.length === 0) return [];
    const rows = await prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
      select: { lessonId: true },
    });
    return rows.map((row: { lessonId: string }) => row.lessonId);
  },

  /** Completed-lesson counts per course for one user, in a single query — powers the "Os meus cursos" progress bars without N+1. */
  async countCompletedByCourse(userId: string, courseIds: string[]): Promise<Record<string, number>> {
    if (courseIds.length === 0) return {};
    const rows = await prisma.lessonProgress.findMany({
      where: {
        userId,
        completedAt: { not: null },
        lesson: { module: { courseId: { in: courseIds } } },
      },
      select: { lesson: { select: { module: { select: { courseId: true } } } } },
    });

    const counts: Record<string, number> = {};
    for (const row of rows) {
      const courseId = row.lesson.module.courseId;
      counts[courseId] = (counts[courseId] ?? 0) + 1;
    }
    return counts;
  },

  /** Total lesson counts per course, in a single query — the denominator for the same progress bars. */
  async countLessonsByCourse(courseIds: string[]): Promise<Record<string, number>> {
    if (courseIds.length === 0) return {};
    const modules = await prisma.courseModule.findMany({
      where: { courseId: { in: courseIds } },
      select: { courseId: true, _count: { select: { lessons: true } } },
    });

    const counts: Record<string, number> = {};
    for (const courseModule of modules) {
      counts[courseModule.courseId] = (counts[courseModule.courseId] ?? 0) + courseModule._count.lessons;
    }
    return counts;
  },
};
