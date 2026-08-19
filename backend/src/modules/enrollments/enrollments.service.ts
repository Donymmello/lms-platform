import { CourseStatus } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { coursesRepository } from "../courses/courses.repository";
import { toListItemDto } from "../courses/courses.service";
import { EnrollmentDto, MyEnrollmentDto } from "./dtos/enrollment.dto";
import { enrollmentsRepository } from "./enrollments.repository";
import { CreateEnrollmentInput } from "./schemas/enrollment.schema";

export const enrollmentsService = {
  async enroll(input: CreateEnrollmentInput, actingUser: AuthenticatedUser): Promise<EnrollmentDto> {
    const course = await coursesRepository.findById(input.courseId);
    if (!course) {
      throw new NotFoundError("Course not found");
    }
    if (course.status !== CourseStatus.PUBLISHED) {
      throw new ForbiddenError("This course is not available for enrollment");
    }
    if (course.priceCents > 0) {
      throw new ForbiddenError("This course requires payment — use POST /payments/checkout instead");
    }

    const existing = await enrollmentsRepository.findByUserAndCourse(actingUser.id, course.id);
    if (existing) {
      throw new ConflictError("You are already enrolled in this course");
    }

    const enrollment = await enrollmentsRepository.create(actingUser.id, course.id);
    return {
      id: enrollment.id,
      courseId: enrollment.courseId,
      createdAt: enrollment.createdAt,
    };
  },

  async listMine(actingUser: AuthenticatedUser): Promise<MyEnrollmentDto[]> {
    const enrollments = await enrollmentsRepository.findManyForUser(actingUser.id);
    return enrollments.map((enrollment) => ({
      id: enrollment.id,
      enrolledAt: enrollment.createdAt,
      course: toListItemDto(enrollment.course),
    }));
  },
};
