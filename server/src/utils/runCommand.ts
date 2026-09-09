import { spawn } from "node:child_process";
import path from "node:path";
import { AppError } from "./appError.js";

export function ffmpegEnv(): NodeJS.ProcessEnv {
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

export function runCommand(command: string, args: string[]): Promise<string> {
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
            `${command} is not installed or not available in PATH. Install FFmpeg and restart the server.`,
            500,
          ),
        );
        return;
      }
      reject(new AppError(`Failed to run ${command}.`, 500));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new AppError(`${command} failed to process the video.`, 500));
        return;
      }
      resolve(stdout || stderr);
    });
  });
}
