import type { Transcript } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Converts a Deepgram Results message into the app's transcript shape. */
export function normalizeDeepgramTranscript(event: unknown): Transcript | null {
  const result = asRecord(event);
  if (!result || result.type !== "Results") return null;

  const channel = asRecord(result.channel);
  const alternatives = channel?.alternatives;
  const firstAlternative = Array.isArray(alternatives) ? asRecord(alternatives[0]) : null;
  const rawText = firstAlternative?.transcript;
  if (typeof rawText !== "string" || !rawText.trim()) return null;

  const start = typeof result.start === "number" ? result.start : 0;
  const duration = typeof result.duration === "number" ? result.duration : 0;
  const confidence =
    typeof firstAlternative?.confidence === "number" ? firstAlternative.confidence : 0;

  return {
    id: `deepgram-${start}`,
    type: "transcript",
    start,
    end: start + duration,
    text: rawText.trim(),
    speaker: 1,
    confidence,
    final: result.is_final === true,
  };
}
