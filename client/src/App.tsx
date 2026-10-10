import { useEffect, useState } from "react";
import { CompletionModal } from "./components/CompletionModal";
import { GeneratedClips } from "./components/GeneratedClips";
import { ProcessingStatus } from "./components/ProcessingStatus";
import { VideoUploader } from "./components/VideoUploader";
import { pollVideoJob, processVideo } from "./services/api";
import { readVideoSession, saveVideoSession } from "./services/session";
import clipvoyLogo from "./assets/clipvoy-logo.svg";
import type { Clip, ProcessingStage } from "./types";
import "./App.css";

function App() {
  const [savedSession] = useState(readVideoSession);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ProcessingStage>(savedSession.jobId ? "queued" : savedSession.clips.length ? "complete" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>(savedSession.clips);
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);

  useEffect(() => {
    if (!savedSession.jobId) return;
    const controller = new AbortController();
    void pollVideoJob(savedSession.jobId, (nextStage) => {
      if (!controller.signal.aborted) setStage(nextStage);
    }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      saveVideoSession({ jobId: null, clips: result.clips });
      setClips(result.clips);
      setStage("complete");
      setIsCompletionOpen(true);
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setStage("idle");
      setError(err instanceof Error ? err.message : "Failed to restore processing status.");
    });
    return () => controller.abort();
  }, [savedSession]);

  const handleProcess = async () => {
    if (!selectedFile) {
      setError("Please select a video file first.");
      return;
    }

    setError(null);
    setIsCompletionOpen(false);
    setStage("uploading");

    try {
      // The server now runs the pipeline in a background worker and
      // reports real progress as it goes, instead of us guessing at
      // timings client-side.
      const result = await processVideo(selectedFile, setStage, (jobId) => {
        saveVideoSession({ jobId, clips });
      });
      saveVideoSession({ jobId: null, clips: result.clips });
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
      <header className="app-header">
        <img src={clipvoyLogo} alt="ClipVoy" className="logo" />
        <span className="header-note">Podcast clipping studio</span>
      </header>

      <div className="workspace">
        <section className="intro" aria-labelledby="page-title">
          <h1 id="page-title">Long conversations.<br />Short, standout clips.</h1>
          <p className="intro-copy">Give your podcast a second life. Turn your recording into vertical clips for TikTok, Reels, and YouTube Shorts.</p>
          <div className="workflow-note">
            <h2>From recording to ready to share</h2>
            <p>Upload your video. ClipVoy transcribes the conversation, selects moments, and generates clips for you to preview and download.</p>
          </div>
        </section>
        <div className="upload-workspace">
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
        </div>
      </div>
      {!isCompletionOpen && <GeneratedClips clips={clips} />}
      {isCompletionOpen && <CompletionModal clips={clips} onClose={() => setIsCompletionOpen(false)} />}
    </main>
  );
}

export default App;
