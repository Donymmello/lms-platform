import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middlewares/authenticate";
import { checkRole } from "../../middlewares/checkRole";
import { validate } from "../../middlewares/validate";
import { auditController } from "./audit.controller";
import { listAuditQuerySchema } from "./schemas/audit.schema";

export const auditRouter = Router();

/**
 * Admin only. The log records who changed whose role and who switched off
 * whose account — reading it is itself a privileged act, and an instructor
 * has no business in it.
 */
auditRouter.use(authenticate, checkRole([Role.ADMIN]));

auditRouter.get("/", validate(listAuditQuerySchema, "query"), auditController.list);
