import { Enrollment, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { listInclude } from "../courses/courses.repository";

export type EnrollmentWithCourse = Prisma.EnrollmentGetPayload<{
  include: { course: { include: typeof listInclude } };
}>;

export const enrollmentsRepository = {
  findByUserAndCourse(userId: string, courseId: string): Promise<Enrollment | null> {
    return prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  },

  create(userId: string, courseId: string, paymentId?: string): Promise<Enrollment> {
    return prisma.enrollment.create({ data: { userId, courseId, paymentId } });
  },

  findManyForUser(userId: string): Promise<EnrollmentWithCourse[]> {
    return prisma.enrollment.findMany({
      where: { userId },
      include: { course: { include: listInclude } },
      orderBy: { createdAt: "desc" },
    });
  },
};
