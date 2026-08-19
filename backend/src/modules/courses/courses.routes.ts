import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { checkRole } from "../../middlewares/checkRole";
import { validate } from "../../middlewares/validate";
import { coursesController } from "./courses.controller";
import {
  courseIdParamSchema,
  createCourseSchema,
  listCoursesQuerySchema,
  updateCourseSchema,
  updateCourseStatusSchema,
} from "./schemas/course.schema";
import { createModuleSchema, moduleIdParamSchema, updateModuleSchema } from "./schemas/module.schema";
import { createLessonSchema, lessonIdParamSchema, updateLessonSchema } from "./schemas/lesson.schema";

export const coursesRouter = Router();

// Course authoring is ADMIN/INSTRUCTOR only; ownership (an INSTRUCTOR can
// only touch their own courses) is enforced in the service layer, since it
// depends on data (course.instructorId) that middleware can't see.
coursesRouter.use(authenticate, checkRole([Role.ADMIN, Role.INSTRUCTOR]));

coursesRouter.get("/", validate(listCoursesQuerySchema, "query"), coursesController.list);
coursesRouter.post("/", validate(createCourseSchema, "body"), coursesController.create);

coursesRouter.get("/:courseId", validate(courseIdParamSchema, "params"), coursesController.getById);
coursesRouter.patch(
  "/:courseId",
  validate(courseIdParamSchema, "params"),
  validate(updateCourseSchema, "body"),
  coursesController.update
);
coursesRouter.delete("/:courseId", validate(courseIdParamSchema, "params"), coursesController.remove);
coursesRouter.patch(
  "/:courseId/status",
  validate(courseIdParamSchema, "params"),
  validate(updateCourseStatusSchema, "body"),
  coursesController.updateStatus
);

coursesRouter.post(
  "/:courseId/modules",
  validate(courseIdParamSchema, "params"),
  validate(createModuleSchema, "body"),
  coursesController.createModule
);
coursesRouter.patch(
  "/:courseId/modules/:moduleId",
  validate(moduleIdParamSchema, "params"),
  validate(updateModuleSchema, "body"),
  coursesController.updateModule
);
coursesRouter.delete(
  "/:courseId/modules/:moduleId",
  validate(moduleIdParamSchema, "params"),
  coursesController.removeModule
);

coursesRouter.post(
  "/:courseId/modules/:moduleId/lessons",
  validate(moduleIdParamSchema, "params"),
  validate(createLessonSchema, "body"),
  coursesController.createLesson
);
coursesRouter.patch(
  "/:courseId/modules/:moduleId/lessons/:lessonId",
  validate(lessonIdParamSchema, "params"),
  validate(updateLessonSchema, "body"),
  coursesController.updateLesson
);
coursesRouter.delete(
  "/:courseId/modules/:moduleId/lessons/:lessonId",
  validate(lessonIdParamSchema, "params"),
  coursesController.removeLesson
);
