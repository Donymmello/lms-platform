import { z } from "zod";

export const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  /** Narrows to one kind of act, e.g. `user.role_changed`. */
  action: z.string().trim().min(1).max(100).optional(),
});
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
