import { Router, type Request, type Response } from "express";
import { uploadVideo } from "../middleware/upload.js";
import { transcribeVideo } from "../services/assemblyai.js";
import { generateClipFile, getVideoDurationSeconds } from "../services/ffmpeg.js";
import { analyzeTranscript } from "../services/openrouter.js";
import { AppError } from "../utils/appError.js";
import { cleanupUpload } from "../utils/cleanup.js";
import type { Clip, ProcessingResponse } from "../types.js";

export const videoRouter = Router();

videoRouter.post("/process", (req, res, next) => {
  uploadVideo(req, res, (err: unknown) => {
    if (err) {
      next(err);
      return;
    }
    void processUploadedVideo(req, res).catch(next);
  });
});

async function processUploadedVideo(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError("No video file uploaded. Use form field name \"video\".", 400);
  }

  console.log(`Received upload: id=${file.filename} size=${file.size}`);

  try {
    const videoDuration = await getVideoDurationSeconds(file.path);
    const segments = await transcribeVideo(file.path);
    const selected = await analyzeTranscript(segments, videoDuration);

    const clips: Clip[] = [];
    for (const clip of selected) {
      const filename = await generateClipFile({
        inputPath: file.path,
        startTime: clip.start,
        endTime: clip.end,
      });

      clips.push({
        ...clip,
        url: `/output/${filename}`,
      });
    }

    const body: ProcessingResponse = { clips };
    //console.log("Sending response")
    res.json(body);
  } finally {
    await cleanupUpload(file.path);
  }
}
