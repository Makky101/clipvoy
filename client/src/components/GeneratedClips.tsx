import type { Clip } from "../types";
import { useState } from "react";
import { clipAssetUrl, downloadClip } from "../services/api";

interface GeneratedClipsProps {
  clips: Clip[];
}

export function GeneratedClips({ clips }: GeneratedClipsProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  if (clips.length === 0) {
    return null;
  }

  const handleDownload = async (url: string, filename: string) => {
    setDownloadingId(filename);
    setDownloadError(null);

    try {
      await downloadClip(url, filename);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setDownloadError(error instanceof Error ? error.message : "Failed to download clip.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className="generated-clips" aria-label="Generated clips">
      <div className="clip-list">
        {clips.map((clip) => {
          const src = clip.url ? clipAssetUrl(clip.url) : "";
          const downloadUrl = clip.downloadUrl ? clipAssetUrl(clip.downloadUrl) : src;
          const filename = `${clip.title.replace(/[^\w\-]+/g, "_")}.mp4`;

          return (
            <article key={src || clip.title} className="clip-card">
              {src && (
                <video controls src={src} preload="metadata">
                  Your browser does not support video playback.
                </video>
              )}
              <h3>{clip.title}</h3>
              <p className="muted">{clip.reason}</p>
              <p className="timestamps">
                {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s
              </p>
              {downloadUrl && (
                <button
                  type="button"
                  className="download"
                  onClick={() => void handleDownload(downloadUrl, filename)}
                  disabled={downloadingId === filename}
                >
                  {downloadingId === filename ? "Saving..." : "Download"}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {downloadError && <p className="error" role="alert">{downloadError}</p>}
    </section>
  );
}
