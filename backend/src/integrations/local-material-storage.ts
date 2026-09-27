import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ValidationError } from "../errors";
import { env } from "../config/env";
import { resolveInside } from "./local-storage-path";

/**
 * Keeps lesson materials — slides, worksheets, source files — on this server's
 * own disk. Unlike video there is no CDN alternative: Bunny Stream hosts video
 * and nothing else, so this is the only path.
 *
 * The stored name is generated here and the original is kept in the database
 * for display. An uploaded name can contain a path, a leading dot, a newline,
 * or 4KB of Unicode; none of that belongs on a filesystem.
 */

/**
 * What an instructor can reasonably attach to a lesson.
 *
 * Deliberately no `.html`, `.htm`, `.svg` or `.xhtml`: those execute script in
 * whatever origin serves them, and these files are served from the API's own
 * origin, where the session cookie lives. `Content-Disposition: attachment`
 * already stops a browser rendering them, but a list that cannot contain them
 * is a better guarantee than a header that must not be forgotten.
 */
const ALLOWED_EXTENSIONS = new Map<string, string>([
  [".pdf", "application/pdf"],
  [".zip", "application/zip"],
  [".txt", "text/plain"],
  [".csv", "text/csv"],
  [".md", "text/markdown"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".odt", "application/vnd.oasis.opendocument.text"],
  [".ods", "application/vnd.oasis.opendocument.spreadsheet"],
  [".odp", "application/vnd.oasis.opendocument.presentation"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

export const ALLOWED_MATERIAL_EXTENSIONS = [...ALLOWED_EXTENSIONS.keys()];

/**
 * Returns the type to store and serve, ignoring whatever the upload claimed.
 * The extension is no more trustworthy, but it is the one the student's
 * operating system will act on when they open the download.
 */
export function materialContentType(originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS.get(extension);

  if (!contentType) {
    throw new ValidationError(
      `Ficheiro não suportado. Aceita-se: ${ALLOWED_MATERIAL_EXTENSIONS.join(", ")}`
    );
  }
  return contentType;
}

export const localMaterialStorage = {
  /** Copies the upload into the materials directory and returns its stored name. */
  async store(sourcePath: string, originalName: string): Promise<string> {
    const extension = path.extname(originalName).toLowerCase();
    materialContentType(originalName);

    const root = path.resolve(env.LOCAL_MATERIAL_DIR);
    await fs.mkdir(root, { recursive: true });

    const storedName = `${crypto.randomUUID()}${extension}`;
    // Copy rather than rename: the temp file usually lives on a different
    // filesystem (os.tmpdir() vs a mounted volume) and rename fails across those.
    await fs.copyFile(sourcePath, path.join(root, storedName));

    return storedName;
  },

  /** Best-effort: an orphaned file costs disk, not correctness. */
  async remove(storedName: string): Promise<void> {
    await fs.unlink(resolveInside(env.LOCAL_MATERIAL_DIR, storedName)).catch(() => undefined);
  },

  async sizeOf(storedName: string): Promise<number> {
    const { size } = await fs.stat(resolveInside(env.LOCAL_MATERIAL_DIR, storedName));
    return size;
  },

  createStream(storedName: string) {
    return createReadStream(resolveInside(env.LOCAL_MATERIAL_DIR, storedName));
  },
};
