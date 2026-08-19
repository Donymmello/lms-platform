import { z } from "zod";
import { moduleIdParamSchema } from "./module.schema";

export const lessonIdParamSchema = moduleIdParamSchema.extend({
  lessonId: z.string().uuid("Invalid lesson id"),
});

export const createLessonSchema = z.object({
  title: z.string().trim().min(2, "Title must have at least 2 characters").max(200),
  description: z.string().trim().max(5000).default(""),
  isFreePreview: z.boolean().default(false),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  isFreePreview: z.boolean().optional(),
  order: z.coerce.number().int().nonnegative().optional(),
});

export type LessonIdParam = z.infer<typeof lessonIdParamSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
