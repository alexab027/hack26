import type { TranscriptSegment } from "./types";

/** Converts raw Deepgram responses into the app's transcript event shape. */
export function normalizeTranscript(_event: unknown): TranscriptSegment {
  // TODO: Map Deepgram interim/final fields, timestamps, confidence, and diarization.
  throw new Error("Transcript normalization is not implemented.");
}

