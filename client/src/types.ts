export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface Clip {
  start: number;
  end: number;
  title: string;
  reason: string;
  url?: string;
  downloadUrl?: string;
}

export interface ProcessingResponse {
  clips: Clip[];
}

export interface JobEnqueuedResponse {
  jobId: string;
}

export interface UploadUrlResponse {
  key: string;
  uploadUrl: string;
}

export type JobStatusResponse =
  | { status: "queued" }
  | { status: "processing"; stage?: "pulling" | "transcribing" | "analyzing" | "generating" | "uploading" }
  | { status: "completed"; clips: Clip[] }
  | { status: "failed"; error: string };

export type ProcessingStage = "idle" | "uploading" | "queued" | "pulling" | "transcribing" | "analyzing" | "generating" | "complete";
