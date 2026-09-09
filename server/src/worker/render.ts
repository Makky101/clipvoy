import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../utils/appError.js";
import { runCommand } from "../utils/runCommand.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const OUTPUT_DIR = path.resolve(__dirname, "../../output");

async function cutClip(options: {
  inputPath: string;
  startTime: number;
  endTime: number;
  outputPath: string;
}): Promise<void> {
  const { inputPath, startTime, endTime, outputPath } = options;
  const duration = endTime - startTime;

  if (duration <= 0) {
    throw new AppError("Invalid clip duration for FFmpeg.", 422);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Re-encode for more accurate cuts than stream copy. This is the CPU-heavy
  // step (scale/crop filter + libx264 encode) that used to run inline on the
  // main server's request handler. It now only ever runs inside the worker
  // process.
  await runCommand("ffmpeg", [
    "-y",
    "-ss",
    startTime.toFixed(3),
    "-i",
    inputPath,
    "-t",
    duration.toFixed(3),
    "-vf",
    "scale=-2:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function renderClip(options: {
  inputPath: string;
  startTime: number;
  endTime: number;
}): Promise<string> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filename = `clip-${uuidv4()}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  await cutClip({
    inputPath: options.inputPath,
    startTime: options.startTime,
    endTime: options.endTime,
    outputPath,
  });

  return filename;
}
