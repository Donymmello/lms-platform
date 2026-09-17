import { CourseStatus } from "@prisma/client";

/** Headline numbers for the dashboard cards, already scoped to what the acting user may see. */
export interface AnalyticsOverviewDto {
  /** Sum of COMPLETED payments only — PENDING/FAILED money is not revenue. */
  totalRevenueCents: number;
  totalPayments: number;
  totalEnrollments: number;
  /** Distinct enrolled users, so one student on three courses counts once. */
  totalStudents: number;
  totalCourses: number;
  publishedCourses: number;
}

/** One UTC day of the revenue series. Days with no payments are present with zeros. */
export interface RevenuePointDto {
  /** YYYY-MM-DD, UTC. */
  date: string;
  revenueCents: number;
  payments: number;
}

export interface RevenueSeriesDto {
  days: number;
  totalRevenueCents: number;
  points: RevenuePointDto[];
}

/** Per-course breakdown — the "which course is actually working" table. */
export interface CourseAnalyticsDto {
  courseId: string;
  title: string;
  slug: string;
  status: CourseStatus;
  enrollments: number;
  revenueCents: number;
  totalLessons: number;
  /** 0-100. Share of all (enrolled student x lesson) pairs that are marked complete. */
  completionPercent: number;
}
