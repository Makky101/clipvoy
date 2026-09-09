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

export type ProcessingStage = "transcribing" | "analyzing" | "generating";

export type JobStatusResponse =
  | { status: "queued" }
  | { status: "processing"; stage?: ProcessingStage }
  | { status: "completed"; clips: Clip[] }
  | { status: "failed"; error: string };

export interface ApiErrorBody {
  error: string;
}
