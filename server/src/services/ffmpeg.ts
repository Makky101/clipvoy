import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../utils/appError.js";
import { runCommand } from "../utils/runCommand.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const OUTPUT_DIR = path.resolve(__dirname, "../../output");

// Clip cutting/encoding (the CPU-heavy work) now lives in ../worker/render.ts
// and runs in a dedicated forked process. This module keeps only the cheap,
// synchronous-feeling ffprobe check needed up front on the main server.
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
