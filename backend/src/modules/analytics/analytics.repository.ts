import { CourseStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

/** The courses an analytics request is allowed to report on, resolved once per request. */
export type ScopedCourse = Prisma.CourseGetPayload<{
  select: { id: true; title: true; slug: true; status: true };
}>;

/**
 * Every method here takes an explicit `courseIds` list rather than a role or
 * a user: scoping is decided once in the service (ADMIN sees everything, an
 * INSTRUCTOR only their own courses) and the repository never has to know
 * the rule. An empty list short-circuits to an empty result instead of
 * issuing a pointless `IN ()` query.
 */
export const analyticsRepository = {
  findScopedCourses(instructorId?: string): Promise<ScopedCourse[]> {
    return prisma.course.findMany({
      where: instructorId ? { instructorId } : {},
      select: { id: true, title: true, slug: true, status: true },
      orderBy: { createdAt: "desc" },
    });
  },

  countPublished(courseIds: string[]): Promise<number> {
    if (courseIds.length === 0) return Promise.resolve(0);
    return prisma.course.count({
      where: { id: { in: courseIds }, status: CourseStatus.PUBLISHED },
    });
  },

  /**
   * Revenue + purchase count per course, COMPLETED only, in one grouped query.
   *
   * Grouped over the items rather than the payments, and summing the item's
   * amount rather than the payment's: since a cart pays for several courses at
   * once, the payment total belongs to no single course. Using it would credit
   * the whole cart to each course in it.
   */
  async sumCompletedPaymentsByCourse(
    courseIds: string[]
  ): Promise<Record<string, { revenueCents: number; payments: number }>> {
    if (courseIds.length === 0) return {};
    const rows = await prisma.paymentItem.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds }, payment: { status: PaymentStatus.COMPLETED } },
      _sum: { amountCents: true },
      _count: { _all: true },
    });

    const totals: Record<string, { revenueCents: number; payments: number }> = {};
    for (const row of rows) {
      totals[row.courseId] = {
        revenueCents: row._sum.amountCents ?? 0,
        payments: row._count._all,
      };
    }
    return totals;
  },

  async countEnrollmentsByCourse(courseIds: string[]): Promise<Record<string, number>> {
    if (courseIds.length === 0) return {};
    const rows = await prisma.enrollment.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds } },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.courseId] = row._count._all;
    }
    return counts;
  },

  /** Distinct enrolled users across the scoped courses — the same person on two courses counts once. */
  async countDistinctStudents(courseIds: string[]): Promise<number> {
    if (courseIds.length === 0) return 0;
    const rows = await prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: { userId: true },
      distinct: ["userId"],
    });
    return rows.length;
  },

  /**
   * Raw COMPLETED payments in the window, for day-bucketing in the service.
   * Bucketing happens in JS because Prisma's groupBy cannot truncate a
   * timestamp to a day, and a raw query would tie this to PostgreSQL.
   */
  findCompletedPaymentsSince(
    courseIds: string[],
    since: Date
  ): Promise<{ createdAt: Date; amountCents: number }[]> {
    if (courseIds.length === 0) return Promise.resolve([]);
    // Items again, for the same reason: only the part of a cart that belongs
    // to these courses counts towards their revenue.
    return prisma.paymentItem
      .findMany({
        where: {
          courseId: { in: courseIds },
          payment: { status: PaymentStatus.COMPLETED, createdAt: { gte: since } },
        },
        select: { amountCents: true, payment: { select: { createdAt: true } } },
        orderBy: { payment: { createdAt: "asc" } },
      })
      .then((rows) => rows.map((row) => ({ createdAt: row.payment.createdAt, amountCents: row.amountCents })));
  },

  /** Total lessons per course — the denominator for completion rate. */
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

  /** Completed lesson rows per course, across every student — the numerator for completion rate. */
  async countCompletedLessonsByCourse(courseIds: string[]): Promise<Record<string, number>> {
    if (courseIds.length === 0) return {};
    const rows = await prisma.lessonProgress.findMany({
      where: {
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
};
