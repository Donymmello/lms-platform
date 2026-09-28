import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { assessmentsService } from "./assessments.service";
import { ModuleIdParam, SaveAssessmentInput, SubmitAttemptInput } from "./schemas/assessment.schema";

export const assessmentsController = {
  saveAssessment: asyncHandler(
    async (req: Request<ModuleIdParam, unknown, SaveAssessmentInput>, res: Response) => {
      const assessment = await assessmentsService.save(req.params.moduleId, req.body, req.user!);
      res.status(200).json({ status: "success", data: { assessment } });
    }
  ),

  removeAssessment: asyncHandler(async (req: Request<ModuleIdParam>, res: Response) => {
    await assessmentsService.remove(req.params.moduleId, req.user!);
    res.status(204).send();
  }),

  getForEditing: asyncHandler(async (req: Request<ModuleIdParam>, res: Response) => {
    const assessment = await assessmentsService.getForEditing(req.params.moduleId, req.user!);
    res.status(200).json({ status: "success", data: { assessment } });
  }),

  getForTaking: asyncHandler(async (req: Request<ModuleIdParam>, res: Response) => {
    const assessment = await assessmentsService.getForTaking(req.params.moduleId, req.user!);
    res.status(200).json({ status: "success", data: { assessment } });
  }),

  submitAttempt: asyncHandler(
    async (req: Request<ModuleIdParam, unknown, SubmitAttemptInput>, res: Response) => {
      const result = await assessmentsService.submitAttempt(req.params.moduleId, req.body, req.user!);
      res.status(201).json({ status: "success", data: { result } });
    }
  ),
};
