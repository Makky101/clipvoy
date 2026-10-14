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
    <section className="min-w-0" aria-label="Generated clips">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((clip) => {
          const src = clip.url ? clipAssetUrl(clip.url) : "";
          const downloadUrl = clip.downloadUrl ? clipAssetUrl(clip.downloadUrl) : src;
          const filename = `${clip.title.replace(/[^\w-]+/g, "_")}.mp4`;

          return (
            <article key={src || clip.title} className="min-w-0 [&>video]:block [&>video]:aspect-[9/16] [&>video]:w-full [&>video]:rounded-xl [&>video]:bg-[#162d46] [&>video]:object-contain [&>h3]:mt-4 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:leading-snug [&>h3]:wrap-anywhere">
              {src && (
                <video controls src={src} preload="metadata">
                  Your browser does not support video playback.
                </video>
              )}
              <h3>{clip.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#52677c]">{clip.reason}</p>
              <p className="mt-3 mb-4 text-xs tabular-nums text-[#52677c]">
                {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s
              </p>
              {downloadUrl && (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] w-full bg-[#162d46] text-white hover:enabled:bg-[#294c70]"
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
      {downloadError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800 wrap-anywhere" role="alert">{downloadError}</p>}
    </section>
  );
}
