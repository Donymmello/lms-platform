import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { checkRole } from "../../middlewares/checkRole";
import { validate } from "../../middlewares/validate";
import { usersController } from "./users.controller";
import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userIdParamSchema,
} from "./schemas/user.schema";

export const usersRouter = Router();

// Every route here is ADMIN-only user management. There is deliberately no
// self-service route: an account becomes an INSTRUCTOR only through
// `PATCH /:id/role` below, by an admin, and that is recorded in the audit log.
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
