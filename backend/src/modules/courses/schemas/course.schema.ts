import { CourseStatus } from "@prisma/client";
import { z } from "zod";

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid("Invalid course id"),
});

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, "Title must have at least 3 characters").max(200),
  description: z.string().trim().max(5000).default(""),
  thumbnailUrl: z.string().trim().url("Invalid URL").optional(),
  priceCents: z.coerce.number().int().nonnegative().default(0),
});

export const updateCourseSchema = createCourseSchema.partial();

export const updateCourseStatusSchema = z.object({
  status: z.nativeEnum(CourseStatus),
});

export const listCoursesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(CourseStatus).optional(),
});

export type CourseIdParam = z.infer<typeof courseIdParamSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type UpdateCourseStatusInput = z.infer<typeof updateCourseStatusSchema>;
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
