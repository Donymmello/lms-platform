import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import { progressController } from "./progress.controller";
import {
  courseIdParamSchema,
  lessonIdParamSchema,
  recordLessonPositionSchema,
  setLessonProgressSchema,
} from "./schemas/progress.schema";

export const progressRouter = Router();

// Unlike playback (public for free-preview lessons), every route here
// requires a logged-in user — tracking or reading *your own* progress makes
// no sense anonymously.
progressRouter.use(authenticate);

progressRouter.get("/me", progressController.getMyProgress);

progressRouter.get(
  "/courses/:courseId",
  validate(courseIdParamSchema, "params"),
  progressController.getCourseProgress
);

progressRouter.put(
  "/lessons/:lessonId",
  validate(lessonIdParamSchema, "params"),
  validate(setLessonProgressSchema, "body"),
  progressController.setLessonProgress
);

// Separate from the manual tick above because it is a different act: the
// player reporting where it got to, many times per lesson, rather than the
// student declaring they are done.
progressRouter.put(
  "/lessons/:lessonId/position",
  validate(lessonIdParamSchema, "params"),
  validate(recordLessonPositionSchema, "body"),
  progressController.recordLessonPosition
);
