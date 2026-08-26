import type { Clip } from "../types";
import { clipAssetUrl } from "../services/api";

interface GeneratedClipsProps {
  clips: Clip[];
}

export function GeneratedClips({ clips }: GeneratedClipsProps) {
  if (clips.length === 0) {
    return null;
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
                <a className="download" href={src} download={filename}>
                  Download
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
