import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { publicCoursesService } from "./public-courses.service";
import { CourseSlugParam, ListPublicCoursesQuery } from "./schemas/public-course.schema";

export const publicCoursesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListPublicCoursesQuery;
    const result = await publicCoursesService.list(query);
    res.status(200).json({ status: "success", data: result });
  }),

  getBySlug: asyncHandler(async (req: Request<CourseSlugParam>, res: Response) => {
    const course = await publicCoursesService.getBySlug(req.params.slug);
    res.status(200).json({ status: "success", data: { course } });
  }),
};
