import { LessonProgress } from "@prisma/client";
import { prisma } from "../../database/prisma";

export interface ProgressRow {
  lessonId: string;
  completedAt: Date | null;
  positionSeconds: number;
  lastAccessedAt: Date;
}

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

  /**
   * Stores how far into the lesson the student has watched.
   *
   * `completedAt` is set in a second statement, guarded on it still being
   * null, so re-watching a finished lesson does not keep moving the date it
   * was completed — and so a rewind never un-completes it.
   */
  async savePosition(
    userId: string,
    lessonId: string,
    positionSeconds: number,
    complete: boolean
  ): Promise<void> {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, positionSeconds },
      update: { positionSeconds },
    });

    if (complete) {
      await prisma.lessonProgress.updateMany({
        where: { userId, lessonId, completedAt: null },
        data: { completedAt: new Date() },
      });
    }
  },

  /** Every progress row the user has for these lessons — completion and position in one query. */
  findProgressFor(userId: string, lessonIds: string[]): Promise<ProgressRow[]> {
    if (lessonIds.length === 0) return Promise.resolve([]);
    return prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, completedAt: true, positionSeconds: true, lastAccessedAt: true },
    });
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
