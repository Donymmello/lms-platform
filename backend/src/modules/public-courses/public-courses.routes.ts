import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { publicCoursesController } from "./public-courses.controller";
import { courseSlugParamSchema, listPublicCoursesQuerySchema } from "./schemas/public-course.schema";

export const publicCoursesRouter = Router();

// Deliberately no `authenticate`/`checkRole` here — this is the public,
// unauthenticated course catalog. Only PUBLISHED courses are ever returned
// (enforced in the repository, not by a query flag a caller could tamper with).
publicCoursesRouter.get("/", validate(listPublicCoursesQuerySchema, "query"), publicCoursesController.list);
publicCoursesRouter.get("/:slug", validate(courseSlugParamSchema, "params"), publicCoursesController.getBySlug);
