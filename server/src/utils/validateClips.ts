import { AppError } from "./appError.js";
import type { Clip, TranscriptSegment } from "../types.js";

const MAX_CLIPS = 3;
const MIN_DURATION_SECONDS = 10;
const MAX_DURATION_SECONDS = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new AppError("The analysis model returned invalid JSON.", 502);
  }
}

function transcriptBounds(segments: TranscriptSegment[]): { minStart: number; maxEnd: number } {
  if (segments.length === 0) {
    return { minStart: 0, maxEnd: 0 };
  }

  return {
    minStart: Math.min(...segments.map((s) => s.start)),
    maxEnd: Math.max(...segments.map((s) => s.end)),
  };
}

export function validateClips(
  payload: unknown,
  videoDurationSeconds: number,
  segments: TranscriptSegment[],
): Clip[] {
  if (!isRecord(payload) || !Array.isArray(payload.clips)) {
    throw new AppError("The analysis model did not return a clips array.", 502);
  }

  const { minStart, maxEnd } = transcriptBounds(segments);
  const durationLimit = Number.isFinite(videoDurationSeconds)
    ? videoDurationSeconds
    : maxEnd;

  const valid: Clip[] = [];

  for (const item of payload.clips) {
    if (valid.length >= MAX_CLIPS) {
      break;
    }

    if (!isRecord(item)) {
      continue;
    }

    const start = Number(item.start);
    const end = Number(item.end);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }
    if (start < 0 || end <= start) {
      continue;
    }

    const clipDuration = end - start;
    if (clipDuration < MIN_DURATION_SECONDS || clipDuration > MAX_DURATION_SECONDS) {
      continue;
    }

    if (end > durationLimit + 0.5) {
      continue;
    }

    if (start < minStart - 1 || end > maxEnd + 1) {
      continue;
    }

    const title =
      typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : "Untitled clip";
    const reason =
      typeof item.reason === "string" && item.reason.trim()
        ? item.reason.trim()
        : "Selected as an engaging standalone moment.";

    valid.push({ start, end, title, reason });
  }

  if (valid.length === 0) {
    throw new AppError(
      "No valid clips were found in the analysis. Try a longer video with clearer speech.",
      422,
    );
  }

  return valid;
}
