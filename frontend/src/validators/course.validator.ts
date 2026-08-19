import { z } from "zod";

// Mirrors backend/src/modules/courses/schemas/course.schema.ts.
export const courseFormSchema = z.object({
  title: z.string().trim().min(3, "O título deve ter pelo menos 3 caracteres").max(200),
  description: z.string().trim().max(5000).default(""),
  thumbnailUrl: z
    .string()
    .trim()
    .url("URL inválido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  priceCents: z.coerce.number().int().nonnegative().default(0),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;
