import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { checkRole } from "../../middlewares/checkRole";
import { validate } from "../../middlewares/validate";
import { coverUpload } from "../../middlewares/coverUpload";
import { materialUpload } from "../../middlewares/materialUpload";
import { videoUpload } from "../../middlewares/videoUpload";
import { coursesController } from "./courses.controller";
import {
  courseIdParamSchema,
  createCourseSchema,
  listCoursesQuerySchema,
  updateCourseSchema,
  updateCourseStatusSchema,
} from "./schemas/course.schema";
import { createModuleSchema, moduleIdParamSchema, updateModuleSchema } from "./schemas/module.schema";
import { createLessonSchema, lessonIdParamSchema, materialIdParamSchema, updateLessonSchema } from "./schemas/lesson.schema";

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

coursesRouter.post(
  "/:courseId/modules/:moduleId/lessons/:lessonId/video",
  validate(lessonIdParamSchema, "params"),
  videoUpload.single("video"),
  coursesController.uploadLessonVideo
);
coursesRouter.delete(
  "/:courseId/modules/:moduleId/lessons/:lessonId/video",
  validate(lessonIdParamSchema, "params"),
  coursesController.removeLessonVideo
);

// Materials are documents rather than video, so they never go near Bunny —
// see local-material-storage.ts. Students download them through the playback
// module, which owns the "is this person allowed to see this lesson?" rule.
coursesRouter.post(
  "/:courseId/modules/:moduleId/lessons/:lessonId/materials",
  validate(lessonIdParamSchema, "params"),
  materialUpload.single("file"),
  coursesController.addLessonMaterial
);
coursesRouter.delete(
  "/:courseId/modules/:moduleId/lessons/:lessonId/materials/:materialId",
  validate(materialIdParamSchema, "params"),
  coursesController.removeLessonMaterial
);

// The cover, uploaded rather than pasted as a URL. Read publicly through
// /api/v1/public/covers — see public-covers.routes.ts.
coursesRouter.post(
  "/:courseId/cover",
  validate(courseIdParamSchema, "params"),
  coverUpload.single("file"),
  coursesController.setCover
);
coursesRouter.delete(
  "/:courseId/cover",
  validate(courseIdParamSchema, "params"),
  coursesController.removeCover
);
