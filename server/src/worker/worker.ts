import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../queue/connection.js";
import { VIDEO_QUEUE_NAME, type VideoJobData, type VideoJobResult } from "../queue/videoQueue.js";
import { transcribeVideo } from "../services/assemblyai.js";
import { Readable } from "node:stream";
import { getVideoDurationSeconds } from "../services/ffmpeg.js";
import { analyzeTranscript } from "../services/openrouter.js";
import { renderClip } from "./render.js";
import type { Clip, ProcessingStage } from "../types.js";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import {S3Client,PutObjectCommand,GetObjectCommand} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// This now controls how many full pipelines (transcribe + analyze + render)
// run concurrently in this worker process, not just concurrent FFmpeg jobs -
// a meaningful step up from the old fork-based worker, which only offloaded
// the render step. Keep this modest; the render step is still the heaviest
// part and multiple encodes will compete for CPU.

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 1;
const bucket = process.env.BUCKET as string
// Cloudflare worker configuration
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.END_POINT,
  credentials: {
    // Provide your R2 Access Key ID and Secret Access Key
    accessKeyId: process.env.ACCESS_KEY_ID as string,
    secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
  },
});

// Use this to stream the video to  ffmpeg
async function downloadVideoToFile(bucket: string, key: string, outputPath: string) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.BUCKET,
      Key: 'whatever data you get from job.data'
    }),
  );

  if (!response.Body) {
    throw new Error("Response body is undefined.");
  }

  const videoStream = response.Body as Readable;
  await pipeline(videoStream, createWriteStream(outputPath))
}

async function generatePresignedUrl(bucket:string,key:string): Promise<string>{
  const tempUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key:key }),
    { expiresIn: 3600 },
  )

  return tempUrl
}

// I have no clue what this function returns too till next time 
async function processVideoJob(job: Job<VideoJobData, VideoJobResult>): Promise<VideoJobResult> {
  // job.data needs to return key
  const { key } = job.data;
  try {
    await job.updateProgress("pulling" satisfies ProcessingStage)
    const url  = await generatePresignedUrl(bucket,key)
    await job.updateProgress("transcribing" satisfies ProcessingStage);
    const videoDuration = await getVideoDurationSeconds(url);
    const segments = await transcribeVideo(url);
    await job.updateProgress("analyzing" satisfies ProcessingStage);
    const selected = await analyzeTranscript(segments, videoDuration);

    await job.updateProgress("generating" satisfies ProcessingStage);
    const streamedVideo = downloadVideoToFile(bucket,key,'I dont know what the output path is')

    const clips: Clip[] = await Promise.all(
      selected.map(async (clip) => {
        const filename = await renderClip({
          inputPath: streamedVideo,
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
  } catch (error: unknown) {
    if (error instanceof Error){
      console.error('This error occured ->', error.message)
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
