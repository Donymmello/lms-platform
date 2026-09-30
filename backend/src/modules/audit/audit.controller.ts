import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { ListAuditQuery } from "./schemas/audit.schema";

export const auditController = {
  /**
   * Newest first, because the question is almost always "what just happened".
   * Read-only by design: there is no endpoint that edits or deletes an entry,
   * since a log an admin can rewrite answers nothing.
   */
  list: asyncHandler(async (req: Request, res: Response) => {
    // Cast rather than a generic, matching the other list endpoints: Express'
    // query type does not accept a narrowed shape.
    const { page, pageSize, action } = req.query as unknown as ListAuditQuery;
    const where = action ? { action } : {};

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        events,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  }),
};
