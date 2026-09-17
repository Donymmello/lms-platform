import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { analyticsService } from "./analytics.service";
import { RevenueQuery } from "./schemas/analytics.schema";

export const analyticsController = {
  getOverview: asyncHandler(async (req: Request, res: Response) => {
    const overview = await analyticsService.getOverview(req.user!);
    res.status(200).json({ status: "success", data: overview });
  }),

  getRevenueSeries: asyncHandler(async (req: Request, res: Response) => {
    // `validate` has already parsed and replaced req.query, so the cast is
    // safe — same pattern as courses.controller.list.
    const query = req.query as unknown as RevenueQuery;
    const series = await analyticsService.getRevenueSeries(query.days, req.user!);
    res.status(200).json({ status: "success", data: series });
  }),

  getCourseBreakdown: asyncHandler(async (req: Request, res: Response) => {
    const courses = await analyticsService.getCourseBreakdown(req.user!);
    res.status(200).json({ status: "success", data: { courses } });
  }),
};
