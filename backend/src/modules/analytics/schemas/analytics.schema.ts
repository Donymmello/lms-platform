import { z } from "zod";

export const revenueQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;
