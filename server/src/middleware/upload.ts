import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../utils/appError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
  "video/ogg",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mkv",
  ".mpeg",
  ".mpg",
  ".ogv",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = file.mimetype.startsWith("video/") || ALLOWED_MIME_TYPES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.has(ext);

  if (mimeOk || extOk) {
    cb(null, true);
    return;
  }

  cb(new AppError("Only video files are allowed.", 400));
}

export const uploadVideo = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single("video");
