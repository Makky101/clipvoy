import { useEffect, useRef, useState, type ChangeEvent } from "react";

function VideoPreview({ file }: { file: File }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const url = URL.createObjectURL(file);
    video.src = url;
    return () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return <>
    <div className="my-6 overflow-hidden rounded-xl border border-slate-200 bg-[#162d46] [&>video]:block [&>video]:aspect-video [&>video]:max-h-80 [&>video]:w-full [&>video]:object-contain">
      <video ref={videoRef} controls playsInline preload="metadata" aria-label={`Preview of ${file.name}`} onError={() => setFailedFile(file)} />
    </div>
    {failedFile === file && <p className="mt-2 text-sm leading-relaxed text-[#52677c]" role="status">Your browser cannot preview this video format. You can still generate clips or choose another video.</p>}
  </>;
}

interface VideoUploaderProps {
  selectedFile: File | null;
  disabled: boolean;
  onFileChange: (file: File | null) => void;
  onProcess: () => void;
}

export function VideoUploader({
  selectedFile,
  disabled,
  onFileChange,
  onProcess,
}: VideoUploaderProps) {

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) onFileChange(file);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:tracking-tight">
      <h2>Upload video</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#52677c]">Select a video up to 60 minutes and 2 GB. Processing uses 1 credit.</p>

      {selectedFile && <VideoPreview file={selectedFile} />}
      <label className={selectedFile ? "inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] shrink-0 border border-slate-300 bg-white text-[#162d46] hover:enabled:bg-slate-50 relative mb-3 has-disabled:cursor-not-allowed has-disabled:opacity-60 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#b84319]" : "relative my-6 flex min-h-60 cursor-pointer items-center justify-center rounded-xl border-2 border-[#52677c] bg-[#edf3f8] p-6 hover:bg-slate-100 has-disabled:cursor-not-allowed has-disabled:opacity-60 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#b84319] before:absolute before:top-3 before:left-3 before:size-6 before:border-t-2 before:border-l-2 before:border-[#b84319] before:content-[''] after:absolute after:right-3 after:bottom-3 after:size-6 after:border-r-2 after:border-b-2 after:border-[#b84319] after:content-['']"}>
        <input
          className="sr-only"
          type="file"
          accept="video/*"
          disabled={disabled}
          onChange={handleChange}
        />
        {selectedFile ? <span>Choose a different video</span> : <span className="flex flex-col items-center gap-3 text-center text-lg font-semibold">
          <svg className="mb-2 size-12 text-[#52677c]" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="5" y="9" width="38" height="30" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M24 31V17m-6 6 6-6 6 6M5 16h6m26 0h6M5 32h6m26 0h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Choose video</span>
          <span className="text-sm font-normal text-[#52677c]">Select your podcast recording</span>
        </span>}
      </label>

      <p className="mb-5 min-h-6 text-sm text-[#52677c] wrap-anywhere">
        {selectedFile ? selectedFile.name : "No file selected"}
      </p>

      <button className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b84319] bg-[#b84319] text-white hover:enabled:bg-[#963613] w-full" type="button" disabled={disabled || !selectedFile} onClick={onProcess}>
        Generate clips
      </button>
    </section>
  );
}
