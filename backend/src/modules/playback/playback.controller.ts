import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { playbackService } from "./playback.service";
import { LessonIdParam } from "./schemas/playback.schema";

export const playbackController = {
  getSignedUrl: asyncHandler(async (req: Request<LessonIdParam>, res: Response) => {
    const result = await playbackService.getSignedUrl(req.params.lessonId, req.user);
    res.status(200).json({ status: "success", data: result });
  }),
};
