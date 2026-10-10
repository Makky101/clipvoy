import { type ChangeEvent } from "react";

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
    onFileChange(file);
  };

  return (
    <section className="panel">
      <h2>Upload video</h2>
      <p className="muted">Select a video file, then start processing.</p>

      <label className="file-picker">
        <input
          type="file"
          accept="video/*"
          disabled={disabled}
          onChange={handleChange}
        />
        <span className="picker-content">
          <svg className="upload-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="5" y="9" width="38" height="30" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M24 31V17m-6 6 6-6 6 6M5 16h6m26 0h6M5 32h6m26 0h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Choose video</span>
          <span className="picker-hint">Select your podcast recording</span>
        </span>
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
