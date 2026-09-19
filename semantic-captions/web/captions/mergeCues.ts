import type { AudioCue, MergedCaption, TranscriptSegment } from "./types";

/** Associates transcript segments and analysis cues by overlapping timestamps. */
export function mergeCues(_segments: TranscriptSegment[], _cues: AudioCue[]): MergedCaption[] {
  // TODO: Define overlap thresholds, interim-update behavior, ordering, and deduplication.
  throw new Error("Timestamp-based caption merging is not implemented.");
}

