import type { JobEnqueuedResponse, JobStatusResponse, ProcessingResponse, ProcessingStage } from "../types";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

const POLL_INTERVAL_MS = 2000;
// The pipeline can genuinely take several minutes (transcription + LLM
// analysis + FFmpeg encoding); this is a ceiling to stop polling forever if
// something goes wrong, not an expected duration.
const MAX_POLL_MS = 20 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processVideo(
  file: File,
  onStage?: (stage: ProcessingStage) => void,
): Promise<ProcessingResponse> {
  const formData = new FormData();
  formData.append("video", file);

  const response = await fetch(`${API_BASE}/api/videos/process`, {
    method: "POST",
    body: formData,
  });

  const enqueued = (await response.json()) as JobEnqueuedResponse & { error?: string };

  if (!response.ok) {
    throw new Error(enqueued.error || "Failed to upload video.");
  }

  if (!enqueued.jobId) {
    throw new Error("The server did not return a job id.");
  }

  onStage?.("queued");

  const startedAt = Date.now();

  // The upload request now returns almost immediately - the actual pipeline
  // runs in a worker process, so we poll for its result instead of awaiting
  // one long request.
  while (true) {
    if (Date.now() - startedAt > MAX_POLL_MS) {
      throw new Error("Processing is taking longer than expected. Please try again later.");
    }

    await sleep(POLL_INTERVAL_MS);

    const statusResponse = await fetch(`${API_BASE}/api/videos/jobs/${enqueued.jobId}`);
    const status = (await statusResponse.json()) as JobStatusResponse & { error?: string };

    if (!statusResponse.ok) {
      throw new Error(status.error || "Failed to check processing status.");
    }

    if (status.status === "completed") {
      return { clips: status.clips };
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Failed to process video.");
    }

    onStage?.(status.status === "processing" ? status.stage ?? "transcribing" : "queued");
  }
}

export function clipAssetUrl(url: string): string {
  return `${API_BASE}${url}`;
}

export async function downloadClip(url: string, filename: string): Promise<void> {
  const response = await fetch(clipAssetUrl(url));

  if (!response.ok) {
    throw new Error("Failed to download clip.");
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(blobUrl);
}
