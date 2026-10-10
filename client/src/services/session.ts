import type { Clip } from "../types";

interface VideoSession {
  jobId: string | null;
  clips: Clip[];
}

const STORAGE_KEY = `clipvoy:video-session:${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}`;

export function readVideoSession(): VideoSession {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && (saved.jobId === null || typeof saved.jobId === "string") &&
      Array.isArray(saved.clips) && saved.clips.every((clip: Clip) =>
        clip && typeof clip.title === "string" && typeof clip.reason === "string" &&
        Number.isFinite(clip.start) && Number.isFinite(clip.end) &&
        (clip.url === undefined || typeof clip.url === "string") &&
        (clip.downloadUrl === undefined || typeof clip.downloadUrl === "string"))) {
      return saved;
    }
  } catch {
    // Corrupt or unavailable browser storage must not prevent using the app.
  }
  return { jobId: null, clips: [] };
}

export function saveVideoSession(session: VideoSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Processing still works when browser storage is unavailable.
  }
}
