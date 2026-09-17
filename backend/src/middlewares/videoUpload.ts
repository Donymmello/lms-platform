import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import { ValidationError } from "../errors";

// Server-proxied upload — the whole file passes through this process before
// reaching Bunny. Fine for typical course-video sizes; much larger files
// should use Bunny's resumable (TUS) upload directly from the browser
// instead of raising this limit further.
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `lms-video-${crypto.randomUUID()}${ext}`);
  },
});

export const videoUpload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      cb(new ValidationError("Only video files are accepted"));
      return;
    }
    cb(null, true);
  },
});
