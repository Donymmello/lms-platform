import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ValidationError } from "../errors";
import { env } from "../config/env";
import { resolveInside } from "./local-storage-path";

/**
 * Course cover images, on this server's own disk.
 *
 * Deliberately a separate directory from lesson materials. Covers are served
 * to anyone who opens the catalogue; materials are behind the paywall. Two
 * directories mean a mistake in the public route cannot reach a paid
 * worksheet, which one shared directory could not promise.
 */

/**
 * PNG, JPEG and WebP only. No SVG: it is a document that can carry script, and
 * these files are served from the API's own origin, where the session cookie
 * lives. No GIF either — nothing here needs animation, and every format left
 * out is one less decoder to think about.
 */
const ALLOWED: Record<string, { contentType: string; matches: (head: Buffer) => boolean }> = {
  ".png": {
    contentType: "image/png",
    matches: (head) => head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  ".jpg": {
    contentType: "image/jpeg",
    matches: (head) => head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  ".jpeg": {
    contentType: "image/jpeg",
    matches: (head) => head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  ".webp": {
    contentType: "image/webp",
    matches: (head) =>
      head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP",
  },
};

export const ALLOWED_COVER_EXTENSIONS = Object.keys(ALLOWED);

export function coverContentType(key: string): string {
  return ALLOWED[path.extname(key).toLowerCase()]?.contentType ?? "application/octet-stream";
}

/** Reads the first bytes and checks the file is what its extension claims. */
async function assertRealImage(filePath: string, extension: string): Promise<void> {
  const rule = ALLOWED[extension];
  if (!rule) {
    throw new ValidationError(`Formato não suportado. Aceita-se: ${ALLOWED_COVER_EXTENSIONS.join(", ")}`);
  }

  const handle = await fs.open(filePath, "r");
  try {
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    if (!rule.matches(head)) {
      // An extension is a claim, not evidence. Renaming a file is free, and
      // this one gets served back with an image content type.
      throw new ValidationError("Este ficheiro não é a imagem que a extensão diz ser.");
    }
  } finally {
    await handle.close();
  }
}

export const localCoverStorage = {
  /**
   * Copies the upload in and returns its key. The name is generated, so a new
   * cover never overwrites an old one and can be cached forever by its URL.
   */
  async store(sourcePath: string, originalName: string): Promise<string> {
    const extension = path.extname(originalName).toLowerCase();
    await assertRealImage(sourcePath, extension);

    const root = path.resolve(env.LOCAL_COVER_DIR);
    await fs.mkdir(root, { recursive: true });

    const key = `${crypto.randomUUID()}${extension}`;
    // Copy rather than rename: the temp file usually lives on another
    // filesystem, and rename fails across those.
    await fs.copyFile(sourcePath, path.join(root, key));

    return key;
  },

  /** Best-effort, like the other stores: an orphaned file costs disk, not correctness. */
  async remove(key: string): Promise<void> {
    await fs.unlink(resolveInside(env.LOCAL_COVER_DIR, key)).catch(() => undefined);
  },

  async sizeOf(key: string): Promise<number> {
    const { size } = await fs.stat(resolveInside(env.LOCAL_COVER_DIR, key));
    return size;
  },

  createStream(key: string) {
    return createReadStream(resolveInside(env.LOCAL_COVER_DIR, key));
  },
};
