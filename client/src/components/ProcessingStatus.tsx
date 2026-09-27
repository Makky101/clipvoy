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
    <section className="processing-status" aria-live="polite">
      {stage !== "idle" && <p className="status">{STAGE_LABELS[stage]}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
