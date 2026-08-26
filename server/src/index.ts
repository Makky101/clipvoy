import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { setGlobalDispatcher, Agent } from 'undici';
import { videoRouter } from "./routes/video.js";
import { OUTPUT_DIR } from "./services/ffmpeg.js";
import { AppError } from "./utils/appError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["http://localhost:5173"];

setGlobalDispatcher(new Agent({
  headersTimeout: 540000, 
  bodyTimeout: 540000
}));

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json());

app.use("/output", express.static(OUTPUT_DIR));
app.use("/api/videos", videoRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Video file is too large. Maximum size is 200MB." });
      return;
    }
    res.status(400).json({ error: "Video upload failed." });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error("Unexpected error:", err instanceof Error ? err.message : "unknown");
  res.status(500).json({ error: "Something went wrong while processing the video." });
});

const server = app.listen(port, () => {
  console.log(`ClipVoy server listening on http://localhost:${port}`);
});

server.timeout = 15 * 60 * 1000;
server.headersTimeout = 15 * 60 * 1000;
