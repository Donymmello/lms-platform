import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { liveSessionsService } from "./live-sessions.service";
import {
  CourseIdParam,
  CreateLiveSessionInput,
  SessionIdParam,
  UpdateLiveSessionInput,
} from "./schemas/live-session.schema";

export const liveSessionsController = {
  listForCourse: asyncHandler(async (req: Request<CourseIdParam>, res: Response) => {
    const sessions = await liveSessionsService.listForCourse(req.params.courseId, req.user!);
    res.status(200).json({ status: "success", data: { sessions } });
  }),

  create: asyncHandler(
    async (req: Request<CourseIdParam, unknown, CreateLiveSessionInput>, res: Response) => {
      const session = await liveSessionsService.create(req.params.courseId, req.body, req.user!);
      res.status(201).json({ status: "success", data: { session } });
    }
  ),

  update: asyncHandler(
    async (req: Request<SessionIdParam, unknown, UpdateLiveSessionInput>, res: Response) => {
      const session = await liveSessionsService.update(req.params.sessionId, req.body, req.user!);
      res.status(200).json({ status: "success", data: { session } });
    }
  ),

  remove: asyncHandler(async (req: Request<SessionIdParam>, res: Response) => {
    await liveSessionsService.remove(req.params.sessionId, req.user!);
    res.status(204).send();
  }),
};
