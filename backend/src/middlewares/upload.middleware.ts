import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { AppError } from "../errors/AppError";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function fileFilter(_req: Request, file: Express.Multer.File, callback: FileFilterCallback): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(new AppError(400, "Only JPEG, PNG, WEBP images or PDF files are allowed"));
    return;
  }

  callback(null, true);
}

// Memory storage only — files go straight to Cloudinary, never persisted to local disk.
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
}).single("file");
