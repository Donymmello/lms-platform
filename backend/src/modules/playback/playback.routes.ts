import { Router } from "express";
import { optionalAuthenticate } from "../../middlewares/optionalAuthenticate";
import { validate } from "../../middlewares/validate";
import { playbackController } from "./playback.controller";
import { lessonIdParamSchema, materialParamSchema } from "./schemas/playback.schema";

export const playbackRouter = Router();

// Deliberately public at the router level — free-preview lessons must be
// watchable without logging in. Non-preview lessons are still gated inside
// playback.service.ts, which requires req.user (populated here only if a
// valid session cookie was present).
// Same access rule as the signed-URL route, re-checked on every request.
playbackRouter.get(
  "/:lessonId/stream",
  validate(lessonIdParamSchema, "params"),
  optionalAuthenticate,
  playbackController.streamLocalVideo
);

playbackRouter.get(
  "/:lessonId/playback",
  validate(lessonIdParamSchema, "params"),
  optionalAuthenticate,
  playbackController.getSignedUrl
);

// Materials sit behind the same access rule as the lesson's video: a free
// preview's are open, a paid course's are not.
playbackRouter.get(
  "/:lessonId/materials/:materialId",
  validate(materialParamSchema, "params"),
  optionalAuthenticate,
  playbackController.downloadMaterial
);
