import { CourseStatus, Role } from "@prisma/client";
import { AuthenticatedUser } from "../../@types/express";
import {
  AnalyticsOverviewDto,
  CourseAnalyticsDto,
  RevenuePointDto,
  RevenueSeriesDto,
} from "./dtos/analytics.dto";
import { analyticsRepository, ScopedCourse } from "./analytics.repository";

/**
 * An ADMIN reports on the whole platform; anyone else reaching this module
 * is an INSTRUCTOR (the router only lets those two roles through) and may
 * only see their own courses. Returning `undefined` means "no filter".
 */
function instructorScopeFor(actingUser: AuthenticatedUser): string | undefined {
  return actingUser.role === Role.ADMIN ? undefined : actingUser.id;
}

/** YYYY-MM-DD in UTC. The whole series is built in UTC so buckets never shift with the server's timezone. */
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight UTC, `daysAgo` days back from today. */
function utcDayStart(daysAgo: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - daysAgo);
  return start;
}

function completionPercent(completedLessons: number, enrollments: number, totalLessons: number): number {
  const possible = enrollments * totalLessons;
  if (possible === 0) return 0;
  // Capped: an instructor or admin ticking lessons on their own course
  // produces progress rows without a matching enrollment, which could
  // otherwise push a small course past 100%.
  return Math.min(100, Math.round((completedLessons / possible) * 100));
}

async function resolveScopedCourses(actingUser: AuthenticatedUser): Promise<ScopedCourse[]> {
  return analyticsRepository.findScopedCourses(instructorScopeFor(actingUser));
}

export const analyticsService = {
  /** Headline cards: revenue, payments, enrollments, distinct students, course counts. */
  async getOverview(actingUser: AuthenticatedUser): Promise<AnalyticsOverviewDto> {
    const courses = await resolveScopedCourses(actingUser);
    const courseIds = courses.map((course) => course.id);

    const [paymentTotals, enrollmentCounts, totalStudents] = await Promise.all([
      analyticsRepository.sumCompletedPaymentsByCourse(courseIds),
      analyticsRepository.countEnrollmentsByCourse(courseIds),
      analyticsRepository.countDistinctStudents(courseIds),
    ]);

    let totalRevenueCents = 0;
    let totalPayments = 0;
    for (const totals of Object.values(paymentTotals)) {
      totalRevenueCents += totals.revenueCents;
      totalPayments += totals.payments;
    }

    const totalEnrollments = Object.values(enrollmentCounts).reduce((sum, count) => sum + count, 0);

    return {
      totalRevenueCents,
      totalPayments,
      totalEnrollments,
      totalStudents,
      totalCourses: courses.length,
      publishedCourses: courses.filter((course) => course.status === CourseStatus.PUBLISHED).length,
    };
  },

  /** Daily COMPLETED revenue over the last `days` days, zero-filled so the chart has no gaps. */
  async getRevenueSeries(days: number, actingUser: AuthenticatedUser): Promise<RevenueSeriesDto> {
    const courses = await resolveScopedCourses(actingUser);
    const courseIds = courses.map((course) => course.id);

    const since = utcDayStart(days - 1);
    const payments = await analyticsRepository.findCompletedPaymentsSince(courseIds, since);

    const buckets = new Map<string, RevenuePointDto>();
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const key = utcDayKey(utcDayStart(offset));
      buckets.set(key, { date: key, revenueCents: 0, payments: 0 });
    }

    let totalRevenueCents = 0;
    for (const payment of payments) {
      const point = buckets.get(utcDayKey(payment.createdAt));
      // A payment can only fall outside the window through a clock skew of
      // less than a day; dropping it beats inventing a bucket for it.
      if (!point) continue;
      point.revenueCents += payment.amountCents;
      point.payments += 1;
      totalRevenueCents += payment.amountCents;
    }

    return { days, totalRevenueCents, points: [...buckets.values()] };
  },

  /** Per-course table: enrollments, revenue and completion rate, best-selling first. */
  async getCourseBreakdown(actingUser: AuthenticatedUser): Promise<CourseAnalyticsDto[]> {
    const courses = await resolveScopedCourses(actingUser);
    const courseIds = courses.map((course) => course.id);

    const [paymentTotals, enrollmentCounts, lessonCounts, completedCounts] = await Promise.all([
      analyticsRepository.sumCompletedPaymentsByCourse(courseIds),
      analyticsRepository.countEnrollmentsByCourse(courseIds),
      analyticsRepository.countLessonsByCourse(courseIds),
      analyticsRepository.countCompletedLessonsByCourse(courseIds),
    ]);

    return courses
      .map((course) => {
        const enrollments = enrollmentCounts[course.id] ?? 0;
        const totalLessons = lessonCounts[course.id] ?? 0;

        return {
          courseId: course.id,
          title: course.title,
          slug: course.slug,
          status: course.status,
          enrollments,
          revenueCents: paymentTotals[course.id]?.revenueCents ?? 0,
          totalLessons,
          completionPercent: completionPercent(completedCounts[course.id] ?? 0, enrollments, totalLessons),
        };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents || b.enrollments - a.enrollments);
  },
};
