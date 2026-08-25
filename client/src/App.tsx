import { useEffect, useRef, useState } from "react";
import { GeneratedClips } from "./components/GeneratedClips";
import { ProcessingStatus } from "./components/ProcessingStatus";
import { VideoUploader } from "./components/VideoUploader";
import { processVideo } from "./services/api";
//import { mockClips } from "./components/mock_data";
import type { Clip, ProcessingStage } from "./types";
import "./App.css";

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const stageTimer = useRef<number | null>(null);

  const pipeline: ProcessingStage[] = ["transcribing", "analyzing", "generating"];

 /* if (clips.length === 0) {
    setClips(mockClips);
  }*/

  useEffect(() => {
    return () => {
      if (stageTimer.current) {
        window.clearInterval(stageTimer.current);
      }
    };
  }, []);

  const clearStageTimer = () => {
    if (stageTimer.current) {
      window.clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      setError("Please select a video file first.");
      return;
    }

    setError(null);
    setClips([]);
    setStage("uploading");

    let pipelineIndex = 0;
    clearStageTimer();
    stageTimer.current = window.setInterval(() => {
      if (pipelineIndex < pipeline.length) {
        setStage(pipeline[pipelineIndex]);
        pipelineIndex += 1;
      }
    }, 8000);

    try {
      const result = await processVideo(selectedFile);
      clearStageTimer();
      setClips(result.clips);
      setStage("complete");
    } catch (err) {
      clearStageTimer();
      setStage("idle");
      setError(err instanceof Error ? err.message : "Failed to process video.");
    }
  };

  const busy = pipeline.includes(stage);

  return (
    <main className="app">
      <header>
        <h1>ClipVoy</h1>
        <p className="muted">Upload a video and generate short-form clips.</p>
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
      <GeneratedClips clips={clips} />
    </main>
  );
}

export default App;
