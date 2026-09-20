import type { Transcript } from "./types";

type ParsedWord = {
  text: string;
  speaker: number | null;
  start: number | null;
  end: number | null;
  confidence: number | null;
};

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

function parseDiarizedWord(value: unknown): ParsedWord | null {
  const word = asRecord(value);
  if (!word) return null;

  const punctuatedWord = word.punctuated_word;
  const rawWord = word.word;
  const text =
    typeof punctuatedWord === "string" && punctuatedWord.trim()
      ? punctuatedWord.trim()
      : typeof rawWord === "string" && rawWord.trim()
        ? rawWord.trim()
        : null;
  if (!text) return null;

  return {
    text,
    speaker:
      typeof word.speaker === "number" &&
      Number.isInteger(word.speaker) &&
      word.speaker >= 0
        ? word.speaker
        : null,
    start: typeof word.start === "number" ? word.start : null,
    end: typeof word.end === "number" ? word.end : null,
    confidence: typeof word.confidence === "number" ? word.confidence : null,
  };
}

/**
 * Converts one diarized Deepgram result into consecutive speaker turns.
 * Deepgram speaker IDs are zero-based. Nearby mode intentionally exposes only
 * two user-facing labels: raw speaker 0 is Speaker 1 and every additional
 * cluster is folded into Speaker 2.
 */
export function normalizeDiarizedDeepgramTranscripts(event: unknown): Transcript[] {
  const fallback = normalizeDeepgramTranscript(event);
  if (!fallback) return [];

  const result = asRecord(event);
  const channel = asRecord(result?.channel);
  const alternatives = channel?.alternatives;
  const firstAlternative = Array.isArray(alternatives) ? asRecord(alternatives[0]) : null;
  const rawWords = firstAlternative?.words;
  if (!Array.isArray(rawWords)) return [fallback];

  const words = rawWords
    .map(parseDiarizedWord)
    .filter((word): word is ParsedWord => word !== null);
  if (words.length === 0) return [fallback];

  const groups: Array<{ speaker: number; words: ParsedWord[] }> = [];
  for (const word of words) {
    const previous = groups.at(-1);
    const speaker = word.speaker ?? previous?.speaker ?? 0;
    if (!previous || previous.speaker !== speaker) {
      groups.push({ speaker, words: [word] });
    } else {
      previous.words.push(word);
    }
  }

  return groups.map((group, index) => {
    const wordConfidences = group.words
      .map((word) => word.confidence)
      .filter((confidence): confidence is number => confidence !== null);
    const confidence =
      wordConfidences.length > 0
        ? wordConfidences.reduce((total, value) => total + value, 0) /
          wordConfidences.length
        : fallback.confidence;

    return {
      ...fallback,
      id: `${fallback.id}-speaker-turn-${index}`,
      start: group.words[0].start ?? fallback.start,
      end: group.words.at(-1)?.end ?? fallback.end,
      text: group.words.map((word) => word.text).join(" "),
      speaker: group.speaker === 0 ? 1 : 2,
      confidence,
    };
  });
}
