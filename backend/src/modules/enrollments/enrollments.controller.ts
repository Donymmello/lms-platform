import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { enrollmentsService } from "./enrollments.service";
import { CreateEnrollmentInput } from "./schemas/enrollment.schema";

export const enrollmentsController = {
  create: asyncHandler(async (req: Request<unknown, unknown, CreateEnrollmentInput>, res: Response) => {
    const enrollment = await enrollmentsService.enroll(req.body, req.user!);
    res.status(201).json({ status: "success", data: { enrollment } });
  }),

  listMine: asyncHandler(async (req: Request, res: Response) => {
    const enrollments = await enrollmentsService.listMine(req.user!);
    res.status(200).json({ status: "success", data: { enrollments } });
  }),
};
