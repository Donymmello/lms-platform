import { CourseStatus } from "@/types/course";

/** Headline numbers for the dashboard cards, already scoped server-side to what the acting user may see. */
export interface AnalyticsOverview {
  /** Sum of COMPLETED payments only. */
  totalRevenueCents: number;
  totalPayments: number;
  totalEnrollments: number;
  /** Distinct enrolled users — one student on three courses counts once. */
  totalStudents: number;
  totalCourses: number;
  publishedCourses: number;
}

/** One UTC day of the revenue series. Days with no payments come back zero-filled. */
export interface RevenuePoint {
  /** YYYY-MM-DD, UTC. */
  date: string;
  revenueCents: number;
  payments: number;
}

export interface RevenueSeries {
  days: number;
  totalRevenueCents: number;
  points: RevenuePoint[];
}

export interface CourseAnalytics {
  courseId: string;
  title: string;
  slug: string;
  status: CourseStatus;
  enrollments: number;
  revenueCents: number;
  totalLessons: number;
  /** 0-100. */
  completionPercent: number;
}
