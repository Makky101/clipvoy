import { Worker, type Job } from "bullmq";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, promises as fs } from "node:fs";
import { getRedisConnection } from "../queue/connection.js";
import { VIDEO_QUEUE_NAME, type VideoJobData, type VideoJobResult } from "../queue/videoQueue.js";
import { transcribeVideo } from "../services/assemblyai.js";
import { Readable } from "node:stream";
import { getVideoDurationSeconds } from "../services/ffmpeg.js";
import { analyzeTranscript } from "../services/openrouter.js";
import { storage, storageBucket } from "../services/storage.js";
import { renderClip } from "./render.js";
import type { Clip, ProcessingStage } from "../types.js";

// This now controls how many full pipelines (transcribe + analyze + render)
// run concurrently in this worker process, not just concurrent FFmpeg jobs -
// a meaningful step up from the old fork-based worker, which only offloaded
// the render step. Keep this modest; the render step is still the heaviest
// part and multiple encodes will compete for CPU.

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 1;

async function getVideoStream(key: string): Promise<Readable> {
  const response = await storage.send(new GetObjectCommand({ Bucket: storageBucket, Key: key }));
  if (!response.Body) {
    throw new Error("Video object has no response body.");
  }

  return response.Body as Readable;
}

async function getDownloadUrl(key: string, filename?: string): Promise<string> {
  return getSignedUrl(
    storage,
    new GetObjectCommand({
      Bucket: storageBucket,
      Key: key,
      ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
    }),
    { expiresIn: 60 * 60 },
  );
}

async function uploadRenderedClip(outputPath: string, key: string): Promise<void> {
  await storage.send(
    new PutObjectCommand({
      Bucket: storageBucket,
      Key: key,
      Body: createReadStream(outputPath),
      ContentType: "video/mp4",
    }),
  );
}

async function processVideoJob(job: Job<VideoJobData, VideoJobResult>): Promise<VideoJobResult> {
  const { key } = job.data;
  try {
    await job.updateProgress("pulling" satisfies ProcessingStage);
    const url = await getDownloadUrl(key);
    await job.updateProgress("transcribing" satisfies ProcessingStage);
    const videoDuration = await getVideoDurationSeconds(url);
    const segments = await transcribeVideo(url);
    await job.updateProgress("analyzing" satisfies ProcessingStage);
    const selected = await analyzeTranscript(segments, videoDuration);
    await job.updateProgress("generating" satisfies ProcessingStage);

    // Each FFmpeg process receives its own S3 body stream. A source stream can
    // only be consumed once, and this keeps the source video out of Node memory.
    const renderedClips = await Promise.all(
      selected.map(async (clip) => {
        const input = await getVideoStream(key);
        const rendered = await renderClip({
          input,
          startTime: clip.start,
          endTime: clip.end,
        });

        return { clip, rendered };
      }),
    );

    await job.updateProgress("uploading" satisfies ProcessingStage);
    const clips: Clip[] = await Promise.all(
      renderedClips.map(async ({ clip, rendered }) => {
        const outputKey = `clips/${rendered.filename}`;
        try {
          await uploadRenderedClip(rendered.outputPath, outputKey);
          const clipUrl = await getDownloadUrl(outputKey);
          const downloadUrl = await getDownloadUrl(outputKey, rendered.filename);

          return { ...clip, url: clipUrl, downloadUrl };
        } finally {
          await fs.unlink(rendered.outputPath).catch(() => undefined);
        }
      }),
    );

    return { clips };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("This error occurred ->", error.message);
    }
    throw error
  }
}

const worker = new Worker<VideoJobData, VideoJobResult>(VIDEO_QUEUE_NAME, processVideoJob, {
  connection: getRedisConnection(),
  concurrency: CONCURRENCY,
});

worker.on("ready", () => {
  console.log(`[worker] Video worker ready (pid=${process.pid}, concurrency=${CONCURRENCY})`);
});

worker.on("completed", (job: Job<VideoJobData, VideoJobResult>) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job: Job<VideoJobData, VideoJobResult> | undefined, error: Error, prev: string) => {
  console.error(`[worker] Job ${job?.id} failed:`, error.message);
});

worker.on("error", (error: Error) => {
  console.error("[worker] Worker error:", error.message);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, shutting down...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
