import { CourseListItemDto } from "../../courses/dtos/course.dto";

export interface EnrollmentDto {
  id: string;
  courseId: string;
  createdAt: Date;
}

/** One row for the "Os meus cursos" list — the enrollment plus its course summary. */
export interface MyEnrollmentDto {
  id: string;
  enrolledAt: Date;
  course: CourseListItemDto;
}
