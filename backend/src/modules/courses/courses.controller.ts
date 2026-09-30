import { Request, Response } from "express";
import { ValidationError } from "../../errors";
import { asyncHandler } from "../../utils/asyncHandler";
import { coursesService } from "./courses.service";
import { courseModulesService } from "./course-modules.service";
import { lessonsService } from "./lessons.service";
import { CourseIdParam, CreateCourseInput, ListCoursesQuery, UpdateCourseInput, UpdateCourseStatusInput } from "./schemas/course.schema";
import { CreateModuleInput, ModuleIdParam, UpdateModuleInput } from "./schemas/module.schema";
import { CreateLessonInput, LessonIdParam, MaterialIdParam, UpdateLessonInput } from "./schemas/lesson.schema";

export const coursesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListCoursesQuery;
    const result = await coursesService.list(query, req.user!);
    res.status(200).json({ status: "success", data: result });
  }),

  getById: asyncHandler(async (req: Request<CourseIdParam>, res: Response) => {
    const course = await coursesService.getById(req.params.courseId, req.user!);
    res.status(200).json({ status: "success", data: { course } });
  }),

  create: asyncHandler(async (req: Request<unknown, unknown, CreateCourseInput>, res: Response) => {
    const course = await coursesService.create(req.body, req.user!);
    res.status(201).json({ status: "success", data: { course } });
  }),

  update: asyncHandler(async (req: Request<CourseIdParam, unknown, UpdateCourseInput>, res: Response) => {
    const course = await coursesService.update(req.params.courseId, req.body, req.user!);
    res.status(200).json({ status: "success", data: { course } });
  }),

  updateStatus: asyncHandler(
    async (req: Request<CourseIdParam, unknown, UpdateCourseStatusInput>, res: Response) => {
      const course = await coursesService.updateStatus(req.params.courseId, req.body, req.user!);
      res.status(200).json({ status: "success", data: { course } });
    }
  ),

  remove: asyncHandler(async (req: Request<CourseIdParam>, res: Response) => {
    await coursesService.remove(req.params.courseId, req.user!);
    res.status(204).send();
  }),

  createModule: asyncHandler(async (req: Request<CourseIdParam, unknown, CreateModuleInput>, res: Response) => {
    const course = await courseModulesService.create(req.params.courseId, req.body, req.user!);
    res.status(201).json({ status: "success", data: { course } });
  }),

  updateModule: asyncHandler(async (req: Request<ModuleIdParam, unknown, UpdateModuleInput>, res: Response) => {
    const course = await courseModulesService.update(
      req.params.courseId,
      req.params.moduleId,
      req.body,
      req.user!
    );
    res.status(200).json({ status: "success", data: { course } });
  }),

  removeModule: asyncHandler(async (req: Request<ModuleIdParam>, res: Response) => {
    const course = await courseModulesService.remove(req.params.courseId, req.params.moduleId, req.user!);
    res.status(200).json({ status: "success", data: { course } });
  }),

  createLesson: asyncHandler(async (req: Request<ModuleIdParam, unknown, CreateLessonInput>, res: Response) => {
    const course = await lessonsService.create(
      req.params.courseId,
      req.params.moduleId,
      req.body,
      req.user!
    );
    res.status(201).json({ status: "success", data: { course } });
  }),

  updateLesson: asyncHandler(async (req: Request<LessonIdParam, unknown, UpdateLessonInput>, res: Response) => {
    const course = await lessonsService.update(
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
      req.body,
      req.user!
    );
    res.status(200).json({ status: "success", data: { course } });
  }),

  removeLesson: asyncHandler(async (req: Request<LessonIdParam>, res: Response) => {
    const course = await lessonsService.remove(
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
      req.user!
    );
    res.status(200).json({ status: "success", data: { course } });
  }),

  uploadLessonVideo: asyncHandler(async (req: Request<LessonIdParam>, res: Response) => {
    if (!req.file) {
      throw new ValidationError("No video file was uploaded (expected a 'video' form field)");
    }
    const course = await lessonsService.uploadVideo(
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
      req.file.path,
      req.file.originalname,
      req.user!
    );
    res.status(200).json({ status: "success", data: { course } });
  }),

  setCover: asyncHandler(async (req: Request<CourseIdParam>, res: Response) => {
    if (!req.file) {
      throw new ValidationError("No image was uploaded (expected a 'file' form field)");
    }
    const course = await coursesService.setCover(req.params.courseId, req.file, req.user!);
    res.status(200).json({ status: "success", data: { course } });
  }),

  removeCover: asyncHandler(async (req: Request<CourseIdParam>, res: Response) => {
    const course = await coursesService.removeCover(req.params.courseId, req.user!);
    res.status(200).json({ status: "success", data: { course } });
  }),

  addLessonMaterial: asyncHandler(async (req: Request<LessonIdParam>, res: Response) => {
    if (!req.file) {
      throw new ValidationError("No file was uploaded (expected a 'file' form field)");
    }
    const course = await lessonsService.addMaterial(
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
      req.file,
      req.user!
    );
    res.status(201).json({ status: "success", data: { course } });
  }),

  removeLessonMaterial: asyncHandler(async (req: Request<MaterialIdParam>, res: Response) => {
    const course = await lessonsService.removeMaterial(
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
      req.params.materialId,
      req.user!
    );
    res.status(200).json({ status: "success", data: { course } });
  }),

  removeLessonVideo: asyncHandler(async (req: Request<LessonIdParam>, res: Response) => {
    const course = await lessonsService.removeVideo(
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
      req.user!
    );
    res.status(200).json({ status: "success", data: { course } });
  }),
};
