import { z } from "zod";

export const lessonIdParamSchema = z.object({
  lessonId: z.string().uuid("Invalid lesson id"),
});

export type LessonIdParam = z.infer<typeof lessonIdParamSchema>;
