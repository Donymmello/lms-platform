import { z } from "zod";

export const lessonIdParamSchema = z.object({
  lessonId: z.string().uuid("Invalid lesson id"),
});

export type LessonIdParam = z.infer<typeof lessonIdParamSchema>;

export const materialParamSchema = lessonIdParamSchema.extend({
  materialId: z.string().uuid("Invalid material id"),
});

export type MaterialParam = z.infer<typeof materialParamSchema>;
