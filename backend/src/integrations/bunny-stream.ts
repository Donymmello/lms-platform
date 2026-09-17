import crypto from "node:crypto";
import fs from "node:fs/promises";
import { env } from "../config/env";
import { AppError } from "../errors";

interface CreateVideoResponse {
  guid: string;
  title: string;
}

function assertManagementConfigured(): void {
  if (!env.BUNNY_STREAM_LIBRARY_ID || !env.BUNNY_STREAM_API_KEY) {
    throw new AppError("Bunny Stream is not configured (missing library id/API key)", 503);
  }
}

function videoUrl(videoId: string): string {
  return `${env.BUNNY_STREAM_BASE_URL}/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`;
}

/**
 * Thin client for Bunny Stream (https://bunny.net/docs/stream/) — video
 * hosting for lesson content. Two separate concerns, two separate
 * credentials: the management API (create/upload/delete, `AccessKey`
 * header with the library's API key) and embed URL signing (a distinct
 * "Token Authentication Key" that never leaves this server).
 */
export const bunnyStream = {
  /** Creates an empty video object in the library; returns its GUID. */
  async createVideo(title: string): Promise<string> {
    assertManagementConfigured();

    const response = await fetch(`${env.BUNNY_STREAM_BASE_URL}/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos`, {
      method: "POST",
      headers: {
        AccessKey: env.BUNNY_STREAM_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(`Bunny Stream video creation failed (${response.status}): ${body}`, 502);
    }

    const payload = (await response.json()) as CreateVideoResponse;
    return payload.guid;
  },

  /**
   * Uploads the binary for a previously-created video. Reads the whole file
   * into memory for a single PUT — fine for typical course-video sizes
   * (the upload endpoint caps at 500MB, see middlewares/videoUpload.ts);
   * much larger files would need Bunny's resumable (TUS) upload instead of
   * proxying through this server.
   */
  async uploadVideoFile(videoId: string, filePath: string): Promise<void> {
    assertManagementConfigured();

    const fileBuffer = await fs.readFile(filePath);
    const response = await fetch(videoUrl(videoId), {
      method: "PUT",
      headers: {
        AccessKey: env.BUNNY_STREAM_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(`Bunny Stream video upload failed (${response.status}): ${body}`, 502);
    }
  },

  /** Best-effort delete — an orphaned Bunny video costs storage, not correctness, so failures here are swallowed. */
  async deleteVideo(videoId: string): Promise<void> {
    if (!env.BUNNY_STREAM_LIBRARY_ID || !env.BUNNY_STREAM_API_KEY) return;

    try {
      await fetch(videoUrl(videoId), {
        method: "DELETE",
        headers: { AccessKey: env.BUNNY_STREAM_API_KEY },
      });
    } catch {
      // Network hiccup deleting a video we're about to replace/remove
      // shouldn't fail the request that triggered it.
    }
  },

  /**
   * Signs a time-limited embed URL (the iframe.mediadelivery.net player —
   * not a direct file URL). Per Bunny's embed token authentication:
   * token = hex(SHA256(tokenAuthKey + videoId + expiresUnixSeconds)).
   */
  getSignedEmbedUrl(videoId: string): { embedUrl: string; expiresAt: Date } {
    if (!env.BUNNY_STREAM_TOKEN_AUTH_KEY || !env.BUNNY_STREAM_LIBRARY_ID) {
      throw new AppError("Bunny Stream token authentication is not configured", 503);
    }

    const expires = Math.floor(Date.now() / 1000) + env.BUNNY_STREAM_TOKEN_TTL_SECONDS;
    const token = crypto
      .createHash("sha256")
      .update(`${env.BUNNY_STREAM_TOKEN_AUTH_KEY}${videoId}${expires}`)
      .digest("hex");

    const embedUrl = `https://iframe.mediadelivery.net/embed/${env.BUNNY_STREAM_LIBRARY_ID}/${videoId}?token=${token}&expires=${expires}`;
    return { embedUrl, expiresAt: new Date(expires * 1000) };
  },
};
