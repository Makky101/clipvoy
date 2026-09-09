import { Router, type Request, type Response } from "express";
import { uploadVideo } from "../middleware/upload.js";
import { getVideoQueue } from "../queue/videoQueue.js";
import { AppError } from "../utils/appError.js";
import type { JobEnqueuedResponse, JobStatusResponse, ProcessingStage } from "../types.js";

const KNOWN_STAGES = new Set<ProcessingStage>(["transcribing", "analyzing", "generating"]);

export const videoRouter = Router();

videoRouter.post("/process", (req, res, next) => {
  uploadVideo(req, res, (err: unknown) => {
    if (err) {
      next(err);
      return;
    }
    void enqueueVideoJob(req, res).catch(next);
  });
});

videoRouter.get("/jobs/:id", (req, res, next) => {
  void getJobStatus(req, res).catch(next);
});

async function enqueueVideoJob(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError('No video file uploaded. Use form field name "video".', 400);
  }

  console.log(`Received upload: id=${file.filename} size=${file.size}`);

  // The heavy pipeline (duration check, transcription, analysis, render) no
  // longer runs on this request at all - it's handed to Redis/BullMQ and
  // picked up whenever a worker process is free. Note the upload is
  // deliberately NOT cleaned up here; the worker owns that once it's done
  // reading the file.
  const job = await getVideoQueue().add("process-video", {
    uploadPath: file.path,
    originalName: file.originalname,
  });

  const body: JobEnqueuedResponse = { jobId: job.id ?? "" };
  res.status(202).json(body);
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
    body = { status: "completed", clips: job.returnvalue?.clips ?? [] };
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
