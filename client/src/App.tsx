import { useState } from "react";
import { CompletionModal } from "./components/CompletionModal";
import { GeneratedClips } from "./components/GeneratedClips";
import { ProcessingStatus } from "./components/ProcessingStatus";
import { VideoUploader } from "./components/VideoUploader";
import { processVideo } from "./services/api";
import clipvoyLogo from "./assets/clipvoy-logo.svg";
import type { Clip, ProcessingStage } from "./types";
import "./App.css";

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);

  const handleProcess = async () => {
    if (!selectedFile) {
      setError("Please select a video file first.");
      return;
    }

    setError(null);
    setClips([]);
    setIsCompletionOpen(false);
    setStage("uploading");

    try {
      // The server now runs the pipeline in a background worker and
      // reports real progress as it goes, instead of us guessing at
      // timings client-side.
      const result = await processVideo(selectedFile, setStage);
      setClips(result.clips);
      setStage("complete");
      setIsCompletionOpen(true);
    } catch (err) {
      setStage("idle");
      setError(err instanceof Error ? err.message : "Failed to process video.");
    }
  };

  const busy = stage !== "idle" && stage !== "complete";

  return (
    <main className="app">
      <header>
        <img src={clipvoyLogo} alt="ClipVoy" className="logo" />
      </header>

      <VideoUploader
        selectedFile={selectedFile}
        disabled={busy}
        onFileChange={(file) => {
          setSelectedFile(file);
          setError(null);
        }}
        onProcess={() => {
          handleProcess();
        }}
      />
      
      <ProcessingStatus stage={stage} error={error} />
      {!isCompletionOpen && <GeneratedClips clips={clips} />}
      {isCompletionOpen && <CompletionModal clips={clips} onClose={() => setIsCompletionOpen(false)} />}
    </main>
  );
}

export default App;
