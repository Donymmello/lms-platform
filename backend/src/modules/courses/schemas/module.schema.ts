import { z } from "zod";
import { courseIdParamSchema } from "./course.schema";

export const moduleIdParamSchema = courseIdParamSchema.extend({
  moduleId: z.string().uuid("Invalid module id"),
});

export const createModuleSchema = z.object({
  title: z.string().trim().min(2, "Title must have at least 2 characters").max(200),
});

export const updateModuleSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  order: z.coerce.number().int().nonnegative().optional(),
});

export type ModuleIdParam = z.infer<typeof moduleIdParamSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
