import { useState } from "react";
import { GeneratedClips } from "./components/GeneratedClips";
import { ProcessingStatus } from "./components/ProcessingStatus";
import { VideoUploader } from "./components/VideoUploader";
import { processVideo } from "./services/api";
import clipvoyLogo from './assets/clipvoy-logo.svg'
//import { mockClips } from "./components/mock_data";
import type { Clip, ProcessingStage } from "./types";
import "./App.css";

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);

  //test videos are stored on mock_videos folder on makky's machine
  // they are not available on server machine!

  /*if (clips.length === 0) {
    setClips(mockClips);
  }*/

  const handleProcess = async () => {
    if (!selectedFile) {
      setError("Please select a video file first.");
      return;
    }

    setError(null);
    setClips([]);
    setStage("uploading");

    try {
      // The server now runs the pipeline in a background worker and
      // reports real progress as it goes, instead of us guessing at
      // timings client-side.
      const result = await processVideo(selectedFile, setStage);
      setClips(result.clips);
      setStage("complete");
    } catch (err) {
      setStage("idle");
      setError(err instanceof Error ? err.message : "Failed to process video.");
    }
  };

  const busy = stage !== "idle" && stage !== "complete";

  return (
    <main className="app">
      <header>
        <img src={clipvoyLogo} alt="ClipVoy-Logo" className="logo"/>
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
