import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";
import type { Clip } from "../types.js";

export const VIDEO_QUEUE_NAME = "video-processing";

export interface VideoJobData {
  uploadPath: string;
  originalName: string;
}

export interface VideoJobResult {
  clips: Clip[];
}

let queue: Queue<VideoJobData, VideoJobResult> | null = null;

// Lazy singleton, same pattern as the old ensureWorker(): importing this
// module shouldn't open a Redis connection by itself, only actually using
// the queue should.
export function getVideoQueue(): Queue<VideoJobData, VideoJobResult> {
  if (!queue) {
    queue = new Queue<VideoJobData, VideoJobResult>(VIDEO_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        // The pipeline is expensive (AssemblyAI + OpenRouter + FFmpeg), so
        // don't silently retry a whole run automatically - a failed job
        // should surface to the caller rather than re-billing external APIs.
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }
  return queue;
}
