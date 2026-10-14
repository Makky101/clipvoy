import type { ProcessingStage } from "../types";

const STAGE_LABELS: Record<Exclude<ProcessingStage, "idle">, string> = {
  uploading: "Uploading video...",
  queued: "Waiting in queue...",
  pulling: "Preparing source...",
  transcribing: "Transcribing video...",
  analyzing: "Analyzing transcript...",
  generating: "Generating clips...",
  complete: "Complete!",
};

interface ProcessingStatusProps {
  stage: ProcessingStage;
  error: string | null;
}

export function ProcessingStatus({ stage, error }: ProcessingStatusProps) {
  if (stage === "idle" && !error) {
    return null;
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4" aria-live="polite">
      {stage !== "idle" && <p className="flex items-center gap-3 text-sm font-semibold before:size-2 before:shrink-0 before:rounded-full before:bg-[#b84319] before:content-['']">{STAGE_LABELS[stage]}</p>}
      {stage !== "idle" && stage !== "complete" && !error && (
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Video processing"
          aria-valuetext={STAGE_LABELS[stage]}
        >
          <span className="block h-full w-full rounded-full bg-[#b84319]/60 motion-safe:animate-pulse" />
        </div>
      )}
      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800 wrap-anywhere">{error}</p>}
    </section>
  );
}
