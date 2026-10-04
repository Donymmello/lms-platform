import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { checkRole } from "../../middlewares/checkRole";
import { instructorRequestRateLimiter } from "../../middlewares/rateLimiter";
import { validate } from "../../middlewares/validate";
import { usersController } from "./users.controller";
import {
  instructorRequestSchema,
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userIdParamSchema,
} from "./schemas/user.schema";

export const usersRouter = Router();

// The one route any signed-in user may call, registered above the ADMIN gate.
//
// Read the service method before changing it. Its predecessor sat on this same
// line and granted the role on the spot, which let a stranger publish in the
// catalogue; this one changes nothing about the account — it records the
// request and mails the admins. Rate-limited because it sends mail to people
// who did not ask for it.
usersRouter.post(
  "/me/instructor-request",
  authenticate,
  instructorRequestRateLimiter,
  validate(instructorRequestSchema, "body"),
  usersController.requestInstructorAccess
);

// Every route below here is ADMIN-only user management. An account becomes an
// INSTRUCTOR only through `PATCH /:id/role`, by an admin, and that is recorded
// in the audit log.
usersRouter.use(authenticate, checkRole([Role.ADMIN]));

usersRouter.get("/", validate(listUsersQuerySchema, "query"), usersController.list);

usersRouter.get("/:id", validate(userIdParamSchema, "params"), usersController.getById);

usersRouter.patch(
  "/:id/role",
  validate(userIdParamSchema, "params"),
  validate(updateUserRoleSchema, "body"),
  usersController.updateRole
);

usersRouter.patch(
  "/:id/status",
  validate(userIdParamSchema, "params"),
  validate(updateUserStatusSchema, "body"),
  usersController.updateStatus
);
