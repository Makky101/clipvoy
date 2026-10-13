import { Router, type Request, type Response } from "express";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { getVideoQueue } from "../queue/videoQueue.js";
import { storage, storageBucket } from "../services/storage.js";
import { AppError } from "../utils/appError.js";
import { getAccount, getCreditJob, requireAccount, reserveCredit, settleCredit } from '../services/accounts.js';
import { dispatchJob } from '../services/dispatch.js';
import type { Clip, JobEnqueuedResponse, JobStatusResponse, ProcessingStage, UploadUrlResponse } from "../types.js";

const KNOWN_STAGES = new Set<ProcessingStage>(["pulling", "transcribing", "analyzing", "generating", "uploading"]);
const ALLOWED_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv", ".mpeg", ".mpg", ".ogv"]);
const MAX_UPLOAD_URL_SECONDS = 15 * 60;

export const videoRouter = Router();
videoRouter.use(requireAccount);

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
  const userId = res.locals.userId as string;
  if (typeof key !== "string" || !key.startsWith(`uploads/${userId}/`) ||
      !/^[0-9a-f-]{36}\.(mp4|webm|mov|avi|mkv|mpeg|mpg|ogv)$/.test(key.slice(`uploads/${userId}/`.length))) {
    throw new AppError("A valid uploaded video key is required.", 400);
  }

  try {
    const object = await storage.send(new HeadObjectCommand({ Bucket: storageBucket, Key: key }));
    if (!object.ContentLength || object.ContentLength > 2 * 1024 * 1024 * 1024) throw new AppError('Videos must be between 1 byte and 2 GB.', 400);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('The uploaded video could not be found. Please upload it again.', 400);
  }
  const job = await reserveCredit(userId, key, typeof originalName === 'string' ? originalName.slice(0, 255) : key);
  if (job.state === 'refunded') throw new AppError('This processing attempt failed and was refunded. Upload the video again to retry.', 409);
  // The reservation is durable. On an ambiguous queue error, the dispatcher
  // retries the same job ID instead of charging again or refunding accepted work.
  void dispatchJob(job).catch((error) => console.error('Queued dispatch will retry:', error instanceof Error ? error.message : 'unknown'));

  const body: JobEnqueuedResponse = { jobId: job.id ?? "" };
  res.status(202).json(body);
}

async function createUploadUrl(req: Request, res: Response): Promise<void> {
  const { fileName, contentType } = req.body as { fileName?: unknown; contentType?: unknown };
  if ((await getAccount(res.locals.userId)).credits < 1) throw new AppError('You have no credits left. Choose a subscription to continue.', 402);
  if (typeof fileName !== "string" || typeof contentType !== "string") {
    throw new AppError("fileName and contentType are required.", 400);
  }

  const extension = path.extname(fileName).toLowerCase();
  if (!contentType.startsWith("video/") || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new AppError("Only supported video files are allowed.", 400);
  }

  const key = `uploads/${res.locals.userId}/${uuidv4()}${extension}`;
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
  const creditJob = await getCreditJob(id, res.locals.userId);
  if (creditJob.state === 'completed') {
    res.json({ status: 'completed', clips: await addDownloadUrls((creditJob.clips ?? []) as Clip[]) });
    return;
  }
  if (creditJob.state === 'refunded') {
    res.json({ status: 'failed', error: 'Processing failed. Your credit has been refunded.' });
    return;
  }
  const job = await getVideoQueue().getJob(id);

  if (!job) {
    res.json({ status: 'queued' });
    return;
  }
  if (job.data.userId !== res.locals.userId) throw new AppError('Job not found.', 404);

  const state = await job.getState();

  let body: JobStatusResponse;
  if (state === "completed") {
    await settleCredit(id, false, job.returnvalue?.clips ?? []);
    body = { status: "completed", clips: await addDownloadUrls(job.returnvalue?.clips ?? []) };
  } else if (state === "failed") {
    await settleCredit(id, true);
    body = { status: "failed", error: 'Processing failed. Your credit has been refunded.' };
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
      if (!clip.url) {
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

      const previewUrl = await getSignedUrl(storage, new GetObjectCommand({ Bucket: storageBucket, Key: key }), { expiresIn: 60 * 60 });
      return { ...clip, url: previewUrl, downloadUrl };
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
