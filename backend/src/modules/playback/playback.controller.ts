import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { contentTypeFor, localVideoStorage } from "../../integrations/local-video-storage";
import { playbackService } from "./playback.service";
import { LessonIdParam } from "./schemas/playback.schema";

/** `bytes=start-end`, either side optional. Anything else is treated as no range at all. */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  // A suffix range ("bytes=-500") means the last N bytes.
  const start = rawStart ? Number(rawStart) : Math.max(0, size - Number(rawEnd || 0));
  const end = rawStart ? (rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1) : size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return null;
  return { start, end };
}

export const playbackController = {
  getSignedUrl: asyncHandler(async (req: Request<LessonIdParam>, res: Response) => {
    const result = await playbackService.getSignedUrl(req.params.lessonId, req.user);
    res.status(200).json({ status: "success", data: result });
  }),

  /**
   * Serves a locally stored lesson video, for deployments with no CDN.
   *
   * Range requests are honoured because without them a browser cannot seek:
   * the whole file has to arrive before the user can jump to the middle of an
   * hour-long lesson, and some players refuse to start at all.
   */
  streamLocalVideo: asyncHandler(async (req: Request<LessonIdParam>, res: Response) => {
    const { videoId } = await playbackService.getLocalFile(req.params.lessonId, req.user);
    const size = await localVideoStorage.sizeOf(videoId);
    const range = parseRange(req.headers.range, size);

    res.setHeader("Content-Type", contentTypeFor(videoId));
    res.setHeader("Accept-Ranges", "bytes");
    // Private: this is paid content behind an access check, and must never be
    // held by a shared cache.
    res.setHeader("Cache-Control", "private, max-age=0, no-store");

    if (!range) {
      res.setHeader("Content-Length", String(size));
      localVideoStorage.createStream(videoId).pipe(res);
      return;
    }

    res.status(206);
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader("Content-Length", String(range.end - range.start + 1));
    localVideoStorage.createStream(videoId, range).pipe(res);
  }),
};
