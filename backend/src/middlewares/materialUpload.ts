import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import { ValidationError } from "../errors";
import { ALLOWED_MATERIAL_EXTENSIONS } from "../integrations/local-material-storage";

/**
 * Lesson materials are documents, not video: 50MB covers a slide deck with
 * screenshots in it and a zip of exercise files, and keeps a single request
 * from filling the disk.
 */
const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname) || "";
    cb(null, `lms-material-${crypto.randomUUID()}${extension}`);
  },
});

export const materialUpload = multer({
  storage,
  limits: { fileSize: MAX_MATERIAL_BYTES },
  // Filtering on the extension rather than the MIME type: browsers disagree
  // about the type of a .docx or a .csv, and the extension is what decides
  // how the file is served and opened later anyway.
  fileFilter: (_req, file, cb) => {
    // multer hands over the multipart file name decoded as latin1, so a
    // Portuguese name arrives mangled ("lição.pdf" as "liÃ§Ã£o.pdf") and gets
    // stored that way. Repairing it here means every consumer downstream —
    // the database row, the extension check, the download header — sees the
    // name the instructor actually chose.
    file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");

    if (!ALLOWED_MATERIAL_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) {
      cb(new ValidationError(`Ficheiro não suportado. Aceita-se: ${ALLOWED_MATERIAL_EXTENSIONS.join(", ")}`));
      return;
    }
    cb(null, true);
  },
});
