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

/**
 * Duration is sent by the client because it is the only side that knows it —
 * lessons often have no stored duration, and a locally uploaded video has none
 * until a browser opens it. It caps the position and sets the completion
 * threshold, so it has to be a real positive length.
 */
export const recordLessonPositionSchema = z.object({
  positionSeconds: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().positive(),
});
export type RecordLessonPositionInput = z.infer<typeof recordLessonPositionSchema>;
