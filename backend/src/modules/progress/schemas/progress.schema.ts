import { z } from "zod";

export const lessonIdParamSchema = z.object({
  lessonId: z.string().uuid("Invalid lesson id"),
});
export type LessonIdParam = z.infer<typeof lessonIdParamSchema>;

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid("Invalid course id"),
});
export type CourseIdParam = z.infer<typeof courseIdParamSchema>;

export const setLessonProgressSchema = z.object({
  completed: z.boolean(),
});
export type SetLessonProgressInput = z.infer<typeof setLessonProgressSchema>;
