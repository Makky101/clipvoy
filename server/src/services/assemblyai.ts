import fs from "node:fs/promises";
import { AppError } from "../utils/appError.js";
import type { TranscriptSegment } from "../types.js";

const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";

function getApiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    throw new AppError("AssemblyAI is not configured. Set ASSEMBLYAI_API_KEY.", 500);
  }
  return key;
}

async function uploadAudioFile(filePath: string, apiKey: string): Promise<string> {
  const fileBytes = await fs.readFile(filePath);

  const response = await fetch(`${ASSEMBLYAI_BASE}/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: fileBytes,
  });

  if (!response.ok) {
    throw new AppError("Failed to upload video to AssemblyAI.", 502);
  }

  const data = (await response.json()) as { upload_url?: string };
  if (!data.upload_url) {
    throw new AppError("AssemblyAI did not return an upload URL.", 502);
  }

  return data.upload_url;
}

interface AssemblyAiTranscript {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  error?: string;
  words?: Array<{ text: string; start: number; end: number }>;
}

async function createTranscript(audioUrl: string, apiKey: string): Promise<string> {
  const response = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      punctuate: true,
      format_text: true,
    }),
  });

  if (!response.ok) {
    throw new AppError("Failed to start AssemblyAI transcription.", 502);
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    throw new AppError("AssemblyAI did not return a transcript id.", 502);
  }

  return data.id;
}

async function pollTranscript(id: string, apiKey: string): Promise<AssemblyAiTranscript> {
  const started = Date.now();
  const timeoutMs = 10 * 60 * 1000;

  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${ASSEMBLYAI_BASE}/transcript/${id}`, {
      headers: { authorization: apiKey },
    });

    if (!response.ok) {
      throw new AppError("Failed to retrieve AssemblyAI transcription status.", 502);
    }

    const data = (await response.json()) as AssemblyAiTranscript;

    if (data.status === "completed") {
      return data;
    }

    if (data.status === "error") {
      throw new AppError(data.error || "Transcription failed.", 502);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new AppError("Transcription timed out. Try a shorter video.", 504);
}

interface SentencePayload {
  sentences?: Array<{ text: string; start: number; end: number }>;
}

async function fetchSentences(id: string, apiKey: string): Promise<TranscriptSegment[]> {
  const response = await fetch(`${ASSEMBLYAI_BASE}/transcript/${id}/sentences`, {
    headers: { authorization: apiKey },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as SentencePayload;
  if (!data.sentences?.length) {
    return [];
  }

  return data.sentences.map((sentence) => ({
    text: sentence.text,
    start: sentence.start / 1000,
    end: sentence.end / 1000,
  }));
}

function segmentsFromWords(words: AssemblyAiTranscript["words"]): TranscriptSegment[] {
  if (!words?.length) {
    return [];
  }

  const segments: TranscriptSegment[] = [];
  let buffer: typeof words = [];

  const flush = () => {
    if (!buffer.length) {
      return;
    }
    segments.push({
      text: buffer.map((w) => w.text).join(" "),
      start: buffer[0].start / 1000,
      end: buffer[buffer.length - 1].end / 1000,
    });
    buffer = [];
  };

  for (const word of words) {
    buffer.push(word);
    if (/[.!?]$/.test(word.text) || buffer.length >= 24) {
      flush();
    }
  }
  flush();

  return segments;
}

export async function transcribeVideo(filePath: string): Promise<TranscriptSegment[]> {
  const apiKey = getApiKey();
  const uploadUrl = await uploadAudioFile(filePath, apiKey);
  const transcriptId = await createTranscript(uploadUrl, apiKey);
  const transcript = await pollTranscript(transcriptId, apiKey);

  //console.log(`Transcription completed (id=${transcriptId}, words=${transcript.words?.length ?? 0})`);

  const sentences = await fetchSentences(transcriptId, apiKey);
  const segments = sentences.length > 0 ? sentences : segmentsFromWords(transcript.words);

  if (segments.length === 0) {
    throw new AppError("Transcription completed but no speech was detected.", 422);
  }

  return segments;
}
