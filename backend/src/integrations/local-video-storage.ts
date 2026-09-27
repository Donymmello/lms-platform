import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { AppError } from "../errors";
import { env } from "../config/env";

/**
 * Keeps lesson videos on this server's own disk, for when Bunny Stream is not
 * configured — which is every fresh checkout and every demo given before
 * anyone has paid for a CDN.
 *
 * What it does not do: transcode, offer adaptive bitrate, or put bytes near
 * the viewer. Every megabyte is served by this process from wherever it runs.
 * That is fine for development and a first handful of students, and is the
 * reason the Bunny path exists at all.
 *
 * Ids are stored in the same `Lesson.bunnyVideoId` column as Bunny's GUIDs but
 * tagged `local:` and carrying the file extension, so a library that has used
 * both providers can always tell which video belongs to which — and switching
 * to Bunny later does not strand the old ones.
 */

const LOCAL_PREFIX = "local:";

/** Only formats a browser can play back directly; there is no transcoding here to rescue the rest. */
const ALLOWED_EXTENSIONS = new Set([".mp4", ".webm", ".ogg", ".ogv", ".mov", ".m4v"]);

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".ogv": "video/ogg",
};

export function isLocalVideoId(videoId: string): boolean {
  return videoId.startsWith(LOCAL_PREFIX);
}

/**
 * Resolves the id to a path inside the storage directory, refusing anything
 * that tries to climb out of it. The id reaches here from the database, but
 * treating it as untrusted costs one comparison and removes a whole class of
 * mistake.
 */
function resolveStoredPath(videoId: string): string {
  const fileName = videoId.slice(LOCAL_PREFIX.length);
  const root = path.resolve(env.LOCAL_VIDEO_DIR);
  const resolved = path.resolve(root, fileName);

  if (resolved !== path.join(root, path.basename(resolved))) {
    throw new AppError("Invalid video reference", 400);
  }
  return resolved;
}

export function contentTypeFor(videoId: string): string {
  return CONTENT_TYPES[path.extname(videoId).toLowerCase()] ?? "application/octet-stream";
}

export const localVideoStorage = {
  /**
   * Unlike Bunny there is no "create then upload" handshake, so the id is
   * minted at upload time and the original extension is kept — it is what
   * tells the browser how to play the file later.
   */
  async store(sourcePath: string, originalName: string): Promise<string> {
    const extension = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new AppError(
        `Without a video CDN configured, only ${[...ALLOWED_EXTENSIONS].join(", ")} can be played back directly`,
        400
      );
    }

    const root = path.resolve(env.LOCAL_VIDEO_DIR);
    await fs.mkdir(root, { recursive: true });

    const fileName = `${crypto.randomUUID()}${extension}`;
    // Copy rather than rename: the temp file usually lives on a different
    // filesystem (os.tmpdir() vs a mounted volume) and rename fails across those.
    await fs.copyFile(sourcePath, path.join(root, fileName));

    return `${LOCAL_PREFIX}${fileName}`;
  },

  /** Best-effort, like Bunny's delete — an orphaned file costs disk, not correctness. */
  async remove(videoId: string): Promise<void> {
    if (!isLocalVideoId(videoId)) return;
    await fs.unlink(resolveStoredPath(videoId)).catch(() => undefined);
  },

  async sizeOf(videoId: string): Promise<number> {
    const { size } = await fs.stat(resolveStoredPath(videoId));
    return size;
  },

  /** `end` is inclusive, matching HTTP's Range semantics. */
  createStream(videoId: string, range?: { start: number; end: number }) {
    return createReadStream(resolveStoredPath(videoId), range);
  },
};
