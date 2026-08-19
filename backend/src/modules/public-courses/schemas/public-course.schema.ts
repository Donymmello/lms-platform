import { z } from "zod";

export const listPublicCoursesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
});

export const courseSlugParamSchema = z.object({
  slug: z.string().trim().min(1, "Invalid course slug"),
});

export type ListPublicCoursesQuery = z.infer<typeof listPublicCoursesQuerySchema>;
export type CourseSlugParam = z.infer<typeof courseSlugParamSchema>;
