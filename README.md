# ClipVoy 

Upload a video, transcribe it with AssemblyAI, find the best short clips with an OpenRouter LLM, then cut those clips with FFmpeg.

## Requirements

- Node.js 18+
- FFmpeg installed and available in `PATH` (includes `ffmpeg` and `ffprobe`)
- AssemblyAI API key
- OpenRouter API key

## Installation

From the project root:

```bash
cd server
npm install
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env` instead of `copy`.

Then edit `server/.env` and add your keys.

```bash
cd ../client
npm install
```

## Environment Variables

Set these in `server/.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port (default `3000`) |
| `ASSEMBLYAI_API_KEY` | AssemblyAI transcription key |
| `OPENROUTER_API_KEY` | OpenRouter LLM key |
| `OPENROUTER_MODEL` | OpenRouter model id, for example `openai/gpt-4o-mini` |
| `CLIENT_URL` | Frontend origin used for CORS (`http://localhost:5173`) |

Never put API keys in the frontend.

## Install FFmpeg

Windows (winget):

```bash
winget install Gyan.FFmpeg
```

Then close and reopen the terminal so `PATH` updates. Confirm with:

```bash
ffmpeg -version
ffprobe -version
```

macOS (Homebrew): `brew install ffmpeg`

Linux (Debian/Ubuntu): `sudo apt install ffmpeg`

## Usage

1. Start the backend:

```bash
cd server
npm run dev
```

2. Start the frontend in another terminal:

```bash
cd client
npm run dev
```

3. Open `http://localhost:5173`
4. Upload a video
5. Click **Process video**
6. Wait for transcription, analysis, and clip generation
7. Play or download the generated clips

Processing is a single request/response. Long videos can take several minutes.

## How it works

```text
Frontend upload
  → POST /api/videos/process (multipart field: video)
  → Unique temp file on disk
  → AssemblyAI transcription (timestamped segments)
  → OpenRouter JSON clip suggestions
  → Timestamp validation
  → FFmpeg cuts unique clip files
  → JSON with public /output/... URLs
  → Frontend players
```

Temporary uploads are deleted after processing. Generated clips stay in `server/output/` so they can be played and downloaded.

## Limitations

- No accounts, database, or cloud storage
- Requests are synchronous (no job queue)
- Clips are not cleaned up automatically
- Best results need clear speech and a video long enough for 20–90s clips
- Maximum upload size is 200MB
