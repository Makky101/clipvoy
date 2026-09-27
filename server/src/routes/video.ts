import { Router, type Request, type Response } from "express";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { getVideoQueue } from "../queue/videoQueue.js";
import { storage, storageBucket } from "../services/storage.js";
import { AppError } from "../utils/appError.js";
import type { Clip, JobEnqueuedResponse, JobStatusResponse, ProcessingStage, UploadUrlResponse } from "../types.js";

const KNOWN_STAGES = new Set<ProcessingStage>(["pulling", "transcribing", "analyzing", "generating", "uploading"]);
const ALLOWED_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv", ".mpeg", ".mpg", ".ogv"]);
const MAX_UPLOAD_URL_SECONDS = 15 * 60;

export const videoRouter = Router();

videoRouter.post("/uploads", (req, res, next) => {
  void createUploadUrl(req, res).catch(next);
});

videoRouter.post("/process", (req, res, next) => {
  void enqueueVideoJob(req, res).catch(next);
});

videoRouter.get("/jobs/:id", (req, res, next) => {
  void getJobStatus(req, res).catch(next);
});

async function enqueueVideoJob(req: Request, res: Response): Promise<void> {
  const { key, originalName } = req.body as { key?: unknown; originalName?: unknown };
  if (typeof key !== "string" || !key.startsWith("uploads/")) {
    throw new AppError("A valid uploaded video key is required.", 400);
  }

  const job = await getVideoQueue().add("process-video", {
    key,
    originalName: typeof originalName === "string" ? originalName : key,
  });

  const body: JobEnqueuedResponse = { jobId: job.id ?? "" };
  res.status(202).json(body);
}

async function createUploadUrl(req: Request, res: Response): Promise<void> {
  const { fileName, contentType } = req.body as { fileName?: unknown; contentType?: unknown };
  if (typeof fileName !== "string" || typeof contentType !== "string") {
    throw new AppError("fileName and contentType are required.", 400);
  }

  const extension = path.extname(fileName).toLowerCase();
  if (!contentType.startsWith("video/") || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new AppError("Only supported video files are allowed.", 400);
  }

  const key = `uploads/${uuidv4()}${extension}`;
  const uploadUrl = await getSignedUrl(
    storage,
    new PutObjectCommand({ Bucket: storageBucket, Key: key, ContentType: contentType }),
    { expiresIn: MAX_UPLOAD_URL_SECONDS },
  );

  const body: UploadUrlResponse = { key, uploadUrl };
  res.status(201).json(body);
}

async function getJobStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const job = await getVideoQueue().getJob(id);

  if (!job) {
    throw new AppError("Job not found.", 404);
  }

  const state = await job.getState();

  let body: JobStatusResponse;
  if (state === "completed") {
    body = { status: "completed", clips: await addDownloadUrls(job.returnvalue?.clips ?? []) };
  } else if (state === "failed") {
    body = { status: "failed", error: job.failedReason ?? "Processing failed." };
  } else if (state === "active") {
    const stage =
      typeof job.progress === "string" && KNOWN_STAGES.has(job.progress as ProcessingStage)
        ? (job.progress as ProcessingStage)
        : undefined;
    body = { status: "processing", stage };
  } else {
    // waiting, delayed, waiting-children, prioritized, etc.
    body = { status: "queued" };
  }

  res.json(body);
}

async function addDownloadUrls(clips: Clip[]): Promise<Clip[]> {
  return Promise.all(
    clips.map(async (clip) => {
      if (clip.downloadUrl || !clip.url) {
        return clip;
      }

      const key = getClipObjectKey(clip.url);
      if (!key) {
        return clip;
      }

      const filename = path.basename(key);
      const downloadUrl = await getSignedUrl(
        storage,
        new GetObjectCommand({
          Bucket: storageBucket,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${filename}"`,
        }),
        { expiresIn: 60 * 60 },
      );

      return { ...clip, downloadUrl };
    }),
  );
}

function getClipObjectKey(url: string): string | null {
  try {
    const key = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
    return key.startsWith("clips/") ? key : null;
  } catch {
    return null;
  }
}
