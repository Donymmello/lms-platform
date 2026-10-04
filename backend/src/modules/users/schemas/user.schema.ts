import { Role } from "@prisma/client";
import { z } from "zod";

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user id"),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  role: z.nativeEnum(Role).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

/**
 * What someone writes when asking to teach. Bounded because it goes straight
 * into an email: a megabyte of text would be a way to abuse the mail server,
 * and 2000 characters is already more than anyone needs to say what they teach.
 */
export const instructorRequestSchema = z.object({
  message: z.string().trim().min(10, "Diz-nos um pouco mais").max(2000),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type InstructorRequestInput = z.infer<typeof instructorRequestSchema>;
