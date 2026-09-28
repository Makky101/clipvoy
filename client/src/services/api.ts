import type {
  JobEnqueuedResponse,
  JobStatusResponse,
  ProcessingResponse,
  ProcessingStage,
  UploadUrlResponse,
} from "../types";

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
): Promise<ProcessingResponse>{
  const contentType = file.type || "video/mp4";
  const uploadRequest = await fetch(`${API_BASE}/api/videos/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType }),
  });

  const uploadDetails = (await uploadRequest.json()) as UploadUrlResponse & { error?: string };
  if (!uploadRequest.ok || !uploadDetails.uploadUrl || !uploadDetails.key) {
    throw new Error(uploadDetails.error || "Failed to prepare the video upload.");
  }

  const uploadResponse = await fetch(uploadDetails.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload the video to storage.");
  }

  const response = await fetch(`${API_BASE}/api/videos/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: uploadDetails.key, originalName: file.name }),
  });

  const enqueued = (await response.json()) as JobEnqueuedResponse & { error?: string };

  if (!response.ok) {
    throw new Error(enqueued.error || "Error_from_server: Failed to upload video.");
  }

  if (!enqueued.jobId) {
    throw new Error("Error_from_server: The server did not return a job id.");
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
      if (!Array.isArray(status.clips) || status.clips.length === 0) {
        throw new Error("Processing completed without any downloadable clips. Please try the video again.");
      }
      return { clips: status.clips };
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Error_from_server: Failed to process video.");
    }

    onStage?.(status.status === "processing" ? status.stage ?? "transcribing" : "queued");
  }
}

export function clipAssetUrl(url: string): string {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_BASE}${url}`;
}

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;

type SavePickerWindow = Window & { showSaveFilePicker?: SaveFilePicker };

export async function downloadClip(url: string, filename: string): Promise<void> {
  const pickerWindow = window as SavePickerWindow;

  if (window.isSecureContext && pickerWindow.showSaveFilePicker) {
    const fileHandle = await pickerWindow.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "MP4 video", accept: { "video/mp4": [".mp4"] } }],
    });
    const response = await fetch(clipAssetUrl(url));

    if (!response.ok || !response.body) {
      throw new Error("Failed to download clip.");
    }

    const writable = await fileHandle.createWritable();
    await response.body.pipeTo(writable);
    return;
  }

  const link = document.createElement("a");
  link.href = clipAssetUrl(url);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

