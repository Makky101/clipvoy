import type { Clip } from "../types";
import { useState } from "react";
import { clipAssetUrl,downloadClip } from "../services/api";

interface GeneratedClipsProps {
  clips: Clip[];
}

export function GeneratedClips({ clips }: GeneratedClipsProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  if (clips.length === 0) {
    return null;
  }

  const handleDownload = async (clip:Clip, filename: string) => {

    if (!clip.url) return;
    setDownloadingId(filename)
    try {
      await downloadClip(clip.url,filename)
    }catch(err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section className="panel">
      <h2>Generated clips</h2>
      <div className="clip-list">
        {clips.map((clip) => {
          const src = clip.url ? clipAssetUrl(clip.url) : "";
          console.log('url ->', clip.url)
          console.log('src ->',src)

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
              {src && (
                <button type="button" className="download" onClick={() => handleDownload(clip,filename)} disabled={downloadingId === filename}>
                  {downloadingId === filename ? "Downloading..." : "Download"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
