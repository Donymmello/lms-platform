import { z } from "zod";

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid("Invalid course id"),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid("Invalid session id"),
});

export const createLiveSessionSchema = z.object({
  title: z.string().trim().min(3, "Title must have at least 3 characters").max(200),
  description: z.string().trim().max(5000).default(""),
  /**
   * Only http(s) is accepted. Without this a `javascript:` URL stored here
   * would come straight back out into an anchor the student clicks.
   */
  joinUrl: z
    .string()
    .trim()
    .url("Invalid meeting link")
    .refine((value) => /^https?:\/\//i.test(value), "The meeting link must start with http:// or https://"),
  startsAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().positive().max(24 * 60).default(60),
});

export const updateLiveSessionSchema = createLiveSessionSchema.partial();

export type CourseIdParam = z.infer<typeof courseIdParamSchema>;
export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
export type CreateLiveSessionInput = z.infer<typeof createLiveSessionSchema>;
export type UpdateLiveSessionInput = z.infer<typeof updateLiveSessionSchema>;
