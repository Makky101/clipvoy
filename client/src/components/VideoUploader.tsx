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
        <span>Choose video</span>
      </label>

      <p className="filename">
        {selectedFile ? selectedFile.name : "No file selected"}
      </p>

      <button type="button" disabled={disabled || !selectedFile} onClick={onProcess}>
        Clip
      </button>
    </section>
  );
}
