import { Router } from "express";
import { z } from "zod";
import { coverContentType, localCoverStorage } from "../../integrations/local-cover-storage";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { coursesService } from "../courses/courses.service";

export const publicCoversRouter = Router();

/**
 * Course covers, readable by anyone. They appear in the catalogue, which has
 * no session, so there is nothing here to authorise.
 *
 * Mounted on its own path rather than under /public/courses, where `covers`
 * would be parsed as a course slug and the two routes would depend on being
 * registered in the right order.
 */
const coverKeyParamSchema = z.object({
  // A generated UUID plus an extension. Anything else cannot be a key we
  // wrote, and the path guard in the store would refuse it anyway.
  key: z
    .string()
    .regex(/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/i, "Invalid cover reference"),
});

publicCoversRouter.get(
  "/:key",
  validate(coverKeyParamSchema, "params"),
  asyncHandler(async (req, res) => {
    // Only keys a course actually points at: a leftover file in the directory
    // is then not reachable by guessing, and a deleted cover stops resolving.
    const key = await coursesService.findCoverKey(req.params.key!);

    res.setHeader("Content-Type", coverContentType(key));
    res.setHeader("Content-Length", String(await localCoverStorage.sizeOf(key)));
    // The name is generated per upload, so a given URL never changes content.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    // Belt and braces on a file a user supplied: the store already checks the
    // magic bytes match the extension, and this stops a browser deciding for
    // itself that the bytes are something else.
    res.setHeader("X-Content-Type-Options", "nosniff");

    localCoverStorage.createStream(key).pipe(res);
  })
);
