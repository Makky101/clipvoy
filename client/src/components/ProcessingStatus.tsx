import type { ProcessingStage } from "../types";

const STAGE_LABELS: Record<Exclude<ProcessingStage, "idle">, string> = {
  uploading: "Uploading video...",
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
    <section className="panel">
      <h2>Status</h2>
      {stage !== "idle" && <p className="status">{STAGE_LABELS[stage]}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
