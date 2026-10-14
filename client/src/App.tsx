import { useEffect, useState, type ReactNode } from "react";
import { CompletionModal } from "./components/CompletionModal";
import { GeneratedClips } from "./components/GeneratedClips";
import { ProcessingStatus } from "./components/ProcessingStatus";
import { VideoUploader } from "./components/VideoUploader";
import { pollVideoJob, processVideo } from "./services/api";
import { readVideoSession, saveVideoSession } from "./services/session";
import clipvoyLogo from "./assets/clipvoy-logo.svg";
import type { Clip, ProcessingStage } from "./types";
import { BillingSection } from './components/BillingSection';
import { useBilling } from './services/billingContext';

function App({ accountBar }: { accountBar?: ReactNode }) {
  const { userId, account, error: accountError, refresh } = useBilling();
  const [savedSession] = useState(() => readVideoSession(userId));
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
      saveVideoSession(userId, { jobId: null, clips: result.clips });
      setClips(result.clips);
      setStage("complete");
      setIsCompletionOpen(true);
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setStage("idle");
      setError(err instanceof Error ? err.message : "Failed to restore processing status.");
      saveVideoSession(userId, { jobId: null, clips: savedSession.clips });
    }).finally(() => {
      if (!controller.signal.aborted) void refresh();
    });
    return () => controller.abort();
  }, [savedSession, userId, refresh]);

  const handleProcess = async () => {
    if (!account || accountError || account.credits < 1) {
      setError('You need an available credit to process a video.');
      return;
    }
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
        saveVideoSession(userId, { jobId, clips });
        void refresh();
      });
      saveVideoSession(userId, { jobId: null, clips: result.clips });
      setClips(result.clips);
      setStage("complete");
      setIsCompletionOpen(true);
    } catch (err) {
      setStage("idle");
      setError(err instanceof Error ? err.message : "Failed to process video.");
    } finally {
      void refresh();
    }
  };

  const busy = stage !== "idle" && stage !== "complete";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16 sm:px-8 lg:px-12">
      <header className="flex items-center justify-between gap-4 border-b border-slate-300 py-2 pb-6">
        <img src={clipvoyLogo} alt="ClipVoy" className="block h-auto w-32 sm:w-40" />
        <span className="max-w-36 text-right text-xs font-medium text-[#52677c] sm:max-w-none sm:text-sm">Podcast clipping studio</span>
      </header>
      <BillingSection accountBar={accountBar} />

      <div className="grid grid-cols-1 items-start gap-10 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <section className="min-w-0 [&>h1]:font-['Barlow_Condensed',sans-serif] [&>h1]:text-5xl [&>h1]:font-semibold [&>h1]:leading-[1.02] [&>h1]:tracking-tight sm:[&>h1]:text-6xl xl:[&>h1]:text-7xl" aria-labelledby="page-title">
          <h1 id="page-title">Long conversations.<br />Short, standout clips.</h1>
          <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-[#52677c]">Give your podcast a second life. Turn your recording into vertical clips for TikTok, Reels, and YouTube Shorts.</p>
          <div className="mt-8 max-w-[48ch] border-l-2 border-[#b84319] pl-5 [&>h2]:text-base [&>h2]:font-semibold [&>p]:mt-2 [&>p]:text-sm [&>p]:leading-relaxed [&>p]:text-[#52677c]">
            <h2>From recording to ready to share</h2>
            <p>Upload your video. ClipVoy transcribes the conversation, selects moments, and generates clips for you to preview and download.</p>
          </div>
        </section>
        <div className="min-w-0">
          <VideoUploader
            selectedFile={selectedFile}
            disabled={busy || !account || Boolean(accountError) || account.credits < 1}
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
      {!isCompletionOpen && clips.length > 0 && <div className="border-t border-slate-300 pt-8"><h2 className="mb-6 text-2xl font-semibold tracking-tight">Your clips</h2><GeneratedClips clips={clips} /></div>}
      {isCompletionOpen && <CompletionModal clips={clips} onClose={() => setIsCompletionOpen(false)} />}
    </main>
  );
}

export default App;
