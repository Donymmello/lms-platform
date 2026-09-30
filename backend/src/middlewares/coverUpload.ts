import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import { ValidationError } from "../errors";
import { ALLOWED_COVER_EXTENSIONS } from "../integrations/local-cover-storage";

/**
 * A cover is one image shown at card size. Five megabytes is already far more
 * than that needs, and keeps a single request from filling the disk.
 */
const MAX_COVER_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname) || "";
    cb(null, `lms-cover-${crypto.randomUUID()}${extension}`);
  },
});

export const coverUpload = multer({
  storage,
  limits: { fileSize: MAX_COVER_BYTES },
  fileFilter: (_req, file, cb) => {
    // Same latin1 repair as materials: multipart names arrive decoded wrong,
    // and the extension is read off this.
    file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");

    if (!ALLOWED_COVER_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) {
      cb(new ValidationError(`Formato não suportado. Aceita-se: ${ALLOWED_COVER_EXTENSIONS.join(", ")}`));
      return;
    }
    cb(null, true);
  },
});
