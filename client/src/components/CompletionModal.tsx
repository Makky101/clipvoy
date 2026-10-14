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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#162d46]/70 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={onClose}>
      <section
        className="max-h-[calc(100dvh-24px)] w-full max-w-5xl overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:max-h-[calc(100dvh-48px)] sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-8 flex items-start justify-between gap-4 [&_h2]:font-['Barlow_Condensed',sans-serif] [&_h2]:text-4xl [&_h2]:font-semibold [&_h2]:leading-tight">
          <div>
            <p className="mb-1 text-sm font-semibold text-[#b84319]">Ready</p>
            <h2 id="completion-title">Your clips are ready</h2>
          </div>
          <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] shrink-0 border border-slate-300 bg-white text-[#162d46] hover:enabled:bg-slate-50" onClick={onClose} aria-label="Close generated clips">
            Close
          </button>
        </div>
        {clips.length > 0 ? <GeneratedClips clips={clips} /> : <p className="mt-2 text-sm leading-relaxed text-[#52677c]">No clips were selected for this video.</p>}
      </section>
    </div>
  );
}
