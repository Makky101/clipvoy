import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../utils/appError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const OUTPUT_DIR = path.resolve(__dirname, "../../output");

function ffmpegEnv(): NodeJS.ProcessEnv {
  const extraDirs: string[] = [];

  if (process.env.FFMPEG_PATH) {
    extraDirs.push(process.env.FFMPEG_PATH);
  }

  if (process.env.LOCALAPPDATA) {
    extraDirs.push(path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links"));
  }

  return {
    ...process.env,
    PATH: [...extraDirs, process.env.PATH ?? ""].join(path.delimiter),
  };
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, env: ffmpegEnv() });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new AppError(
            "FFmpeg is not installed or not available in PATH. Install FFmpeg and restart the server.",
            500,
          ),
        );
        return;
      }
      reject(new AppError("Failed to run FFmpeg.", 500));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new AppError("FFmpeg failed to process the video.", 500));
        return;
      }
      resolve(stdout || stderr);
    });
  });
}

export async function getVideoDurationSeconds(inputPath: string): Promise<number> {
  const output = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);

  const duration = Number.parseFloat(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AppError("Could not determine video duration.", 422);
  }

  return duration;
}

export async function cutClip(options: {
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

  // Re-encode for more accurate cuts than stream copy.
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

export async function generateClipFile(options: {
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
