import type { ProcessingResponse } from "../types";
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

export async function processVideo(file: File): Promise<ProcessingResponse> {
  const formData = new FormData();
  formData.append("video", file);
  
  const response = await fetch(`${API_BASE}/api/videos/process`, {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as ProcessingResponse & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to process video.");
  }

  if (!payload.clips) {
    throw new Error("The server did not return any clips.");
  }

  return payload;
}

export function clipAssetUrl(url: string): string {

  /*if (url.startsWith("http://") || url.startsWith("https://")){
    return url;
  }*/
  
  return `${API_BASE}${url}`;
}

export async function downloadClip(url:string, filename:string): Promise<void> {
  const response = await fetch(clipAssetUrl(url))

  if (!response.ok){
    throw new Error("Failed to download clip.")
  }

  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(blobUrl)
}
