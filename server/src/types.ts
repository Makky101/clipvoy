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

export interface ApiErrorBody {
  error: string;
}
