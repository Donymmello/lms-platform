import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { checkRole } from "../../middlewares/checkRole";
import { validate } from "../../middlewares/validate";
import { liveSessionsController } from "./live-sessions.controller";
import {
  courseIdParamSchema,
  createLiveSessionSchema,
  sessionIdParamSchema,
  updateLiveSessionSchema,
} from "./schemas/live-session.schema";

export const liveSessionsRouter = Router();

// Reading requires a session but not a role: whether this particular user may
// see a particular course's classes depends on their enrolment, which only
// the service can check.
liveSessionsRouter.use(authenticate);

liveSessionsRouter.get(
  "/courses/:courseId",
  validate(courseIdParamSchema, "params"),
  liveSessionsController.listForCourse
);

// Scheduling is course authoring, so it matches the /courses routes: the role
// gate is here, and ownership (an INSTRUCTOR only touching their own courses)
// is enforced in the service, where course.instructorId is visible.
liveSessionsRouter.post(
  "/courses/:courseId",
  checkRole([Role.ADMIN, Role.INSTRUCTOR]),
  validate(courseIdParamSchema, "params"),
  validate(createLiveSessionSchema, "body"),
  liveSessionsController.create
);

liveSessionsRouter.patch(
  "/:sessionId",
  checkRole([Role.ADMIN, Role.INSTRUCTOR]),
  validate(sessionIdParamSchema, "params"),
  validate(updateLiveSessionSchema, "body"),
  liveSessionsController.update
);

liveSessionsRouter.delete(
  "/:sessionId",
  checkRole([Role.ADMIN, Role.INSTRUCTOR]),
  validate(sessionIdParamSchema, "params"),
  liveSessionsController.remove
);
