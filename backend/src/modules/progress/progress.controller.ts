import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { progressService } from "./progress.service";
import { CourseIdParam, LessonIdParam, SetLessonProgressInput } from "./schemas/progress.schema";

export const progressController = {
  setLessonProgress: asyncHandler(
    async (req: Request<LessonIdParam, unknown, SetLessonProgressInput>, res: Response) => {
      const result = await progressService.toggleComplete(req.params.lessonId, req.body.completed, req.user!);
      res.status(200).json({ status: "success", data: result });
    }
  ),

  getCourseProgress: asyncHandler(async (req: Request<CourseIdParam>, res: Response) => {
    const result = await progressService.getCourseProgress(req.params.courseId, req.user!);
    res.status(200).json({ status: "success", data: result });
  }),

  getMyProgress: asyncHandler(async (req: Request, res: Response) => {
    const courses = await progressService.getMySummary(req.user!);
    res.status(200).json({ status: "success", data: { courses } });
  }),
};
