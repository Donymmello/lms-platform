import { z } from "zod";

export const createEnrollmentSchema = z.object({
  courseId: z.string().uuid("Invalid course id"),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
