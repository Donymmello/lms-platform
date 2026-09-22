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

// Self-service, so it is deliberately registered before the ADMIN gate
// below: any signed-in user may turn their own account into an instructor
// account. It takes no id — the target is always `req.user`.
usersRouter.post("/me/become-instructor", authenticate, usersController.becomeInstructor);

// Every route below here is ADMIN-only user management.
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
