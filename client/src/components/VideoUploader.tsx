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
    <div className="file-picker video-preview">
      <video ref={videoRef} controls playsInline preload="metadata" aria-label={`Preview of ${file.name}`} onError={() => setFailedFile(file)} />
    </div>
    {failedFile === file && <p className="muted" role="status">Your browser cannot preview this video format. You can still generate clips or choose another video.</p>}
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
    <section className="panel">
      <h2>Upload video</h2>
      <p className="muted">Select a video up to 60 minutes and 2 GB. Processing uses 1 credit.</p>

      {selectedFile && <VideoPreview file={selectedFile} />}
      <label className={selectedFile ? 'file-change' : 'file-picker'}>
        <input
          type="file"
          accept="video/*"
          disabled={disabled}
          onChange={handleChange}
        />
        {selectedFile ? <span>Choose a different video</span> : <span className="picker-content">
          <svg className="upload-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="5" y="9" width="38" height="30" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M24 31V17m-6 6 6-6 6 6M5 16h6m26 0h6M5 32h6m26 0h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Choose video</span>
          <span className="picker-hint">Select your podcast recording</span>
        </span>}
      </label>

      <p className="filename">
        {selectedFile ? selectedFile.name : "No file selected"}
      </p>

      <button type="button" disabled={disabled || !selectedFile} onClick={onProcess}>
        Generate clips
      </button>
    </section>
  );
}
