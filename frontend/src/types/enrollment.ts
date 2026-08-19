import { CourseListItem } from "./course";

export interface EnrollmentSummary {
  id: string;
  courseId: string;
  createdAt: string;
}

/** One row for the "Os meus cursos" list — the enrollment plus its course summary. */
export interface MyEnrollment {
  id: string;
  enrolledAt: string;
  course: CourseListItem;
}
