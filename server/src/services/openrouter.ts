import { AppError } from "../utils/appError.js";
import { extractJsonObject, validateClips } from "../utils/validateClips.js";
import type { Clip, TranscriptSegment } from "../types.js";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new AppError("OpenRouter is not configured. Set OPENROUTER_API_KEY.", 500);
  }
  return key;
}

function buildPrompt(segments: TranscriptSegment[]): string {
  return [
    "You are an editor that finds the best short-form clips in a long video transcript.",
    "Analyze the timestamped transcript and identify up to 3 engaging standalone clips.",
    "Look for: strong hooks, interesting opinions, surprising statements, useful information,",
    "emotional moments, controversial or engaging moments, and clear standalone sections.",
    "",
    "Rules:",
    "- Return valid JSON only. No markdown. No explanation outside JSON.",
    "- Use only timestamps that exist in the transcript.",
    "- start must be less than end.",
    "- Prefer clip durations between 20 and 45 seconds.",
    " - Only exceed 45 seconds if the hook and its payoff cannot be separated without losing the point — even then, never exceed 60 seconds.",
    "- Return a maximum of 3 clips.",
    "",
    "Required JSON shape:",
    '{"clips":[{"start":125.4,"end":172.8,"title":"Why Most People Fail","reason":"Strong hook and standalone insight"}]}',
    "",
    "Transcript segments (start/end in seconds):",
    JSON.stringify(segments),
  ].join("\n");
}

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: { message?: string };
}

export async function analyzeTranscript(
  segments: TranscriptSegment[],
  videoDurationSeconds: number,
): Promise<Clip[]> {
  const apiKey = getApiKey();
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
      "X-Title": "ClipVoy",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You return only valid JSON matching the requested schema.",
        },
        {
          role: "user",
          content: buildPrompt(segments),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new AppError("OpenRouter analysis failed.", 502);
  }

  const data = (await response.json()) as OpenRouterResponse;
  if (data.error?.message) {
    throw new AppError("OpenRouter analysis failed.", 502);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError("The analysis model returned an empty response.", 502);
  }

  let parsed: unknown;
  try {
    parsed = extractJsonObject(content);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("The analysis model returned invalid JSON.", 502);
  }

  return validateClips(parsed, videoDurationSeconds, segments);
}