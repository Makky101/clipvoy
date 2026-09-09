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
}

export interface ProcessingResponse {
  clips: Clip[];
}

export interface JobEnqueuedResponse {
  jobId: string;
}

export type JobStatusResponse =
  | { status: "queued" }
  | { status: "processing"; stage?: "transcribing" | "analyzing" | "generating" }
  | { status: "completed"; clips: Clip[] }
  | { status: "failed"; error: string };

export type ProcessingStage = "idle" | "uploading" | "queued" | "transcribing" | "analyzing" | "generating" | "complete";