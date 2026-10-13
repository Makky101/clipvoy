# ClipVoy 

Upload a video, transcribe it with AssemblyAI, find the best short clips with an OpenRouter LLM, then cut those clips with FFmpeg.

Accounts now use Supabase authentication and durable credits. New accounts get 3 free credits; each video processing job costs 1 credit. Weekly and monthly subscriptions use Stripe Checkout and verified paid-invoice webhooks. **Before processing videos, follow [credits and Stripe setup](docs/billing-setup.md)**, run the SQL migration, and configure the server-side Supabase key. Payment credentials stay in `server/.env`; browser credentials stay in `client/.env.local`.

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

Never put secret API keys in the frontend. The Supabase publishable key is intended for the browser.

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

Run `npm run worker` in a separate terminal in `server`. Processing uses a BullMQ queue backed by Redis; the client polls the authenticated job endpoint. Long videos can take several minutes.

## How it works

```text
Frontend upload
  → Authenticated POST /api/videos/uploads (signed upload URL)
  → Direct video upload to object storage
  → POST /api/videos/process (atomic credit reservation + queue)
  → AssemblyAI transcription (timestamped segments)
  → OpenRouter JSON clip suggestions
  → Timestamp validation
  → FFmpeg cuts unique clip files
  → Authenticated job polling + signed clip download URLs
  → Frontend players
```

Uploaded recordings and generated clips stay in object storage according to the bucket's lifecycle rules. Temporary rendered files are removed after uploading.

## Limitations

- Requires Supabase, Redis, an object-storage bucket, and a running worker
- Storage retention must be configured on the bucket
- Best results need clear speech and a video long enough for 20–90s clips
- Maximum recording length is 60 minutes; maximum upload size is 2 GB
