import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../queue/connection.js";
import { VIDEO_QUEUE_NAME, type VideoJobData, type VideoJobResult } from "../queue/videoQueue.js";
import { transcribeVideo } from "../services/assemblyai.js";
import { getVideoDurationSeconds } from "../services/ffmpeg.js";
import { analyzeTranscript } from "../services/openrouter.js";
import { cleanupUpload } from "../utils/cleanup.js";
import { renderClip } from "./render.js";
import type { Clip, ProcessingStage } from "../types.js";

// This now controls how many full pipelines (transcribe + analyze + render)
// run concurrently in this worker process, not just concurrent FFmpeg jobs -
// a meaningful step up from the old fork-based worker, which only offloaded
// the render step. Keep this modest; the render step is still the heaviest
// part and multiple encodes will compete for CPU.
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 1;

async function processVideoJob(job: Job<VideoJobData, VideoJobResult>): Promise<VideoJobResult> {
  const { uploadPath } = job.data;

  try {
    await job.updateProgress("transcribing" satisfies ProcessingStage);
    const videoDuration = await getVideoDurationSeconds(uploadPath);
    const segments = await transcribeVideo(uploadPath);

    await job.updateProgress("analyzing" satisfies ProcessingStage);
    const selected = await analyzeTranscript(segments, videoDuration);

    await job.updateProgress("generating" satisfies ProcessingStage);
    const clips: Clip[] = await Promise.all(
      selected.map(async (clip) => {
        const filename = await renderClip({
          inputPath: uploadPath,
          startTime: clip.start,
          endTime: clip.end,
        });

        return {
          ...clip,
          url: `/output/${filename}`,
        };
      }),
    );

    return { clips };
  } finally {
    // The upload can only be cleaned up once rendering is done with it - it
    // used to happen in the route's finally block, but the route no longer
    // holds the request open long enough to own that responsibility.
    await cleanupUpload(uploadPath);
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
