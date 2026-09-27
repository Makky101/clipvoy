import { useEffect } from "react";
import type { Clip } from "../types";
import { GeneratedClips } from "./GeneratedClips";

interface CompletionModalProps {
  clips: Clip[];
  onClose: () => void;
}

export function CompletionModal({ clips, onClose }: CompletionModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="completion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Ready</p>
            <h2 id="completion-title">Your clips are ready</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close generated clips">
            Close
          </button>
        </div>
        {clips.length > 0 ? <GeneratedClips clips={clips} /> : <p className="muted">No clips were selected for this video.</p>}
      </section>
    </div>
  );
}
