import type { AudioCue, MergedCaption, TranscriptSegment } from "./types";

/** Associates transcript segments and analysis cues by overlapping timestamps. */
export function mergeCues<T extends TranscriptSegment>(
  segments: T[],
  cues: AudioCue[],
): Array<T & MergedCaption> {
  const merged = segments.map((segment) => ({ ...segment, cues: [] as AudioCue[] }));
  for (const cue of cues) {
    const caption = merged.find(
      (segment) => cue.start < segment.end && cue.end > segment.start,
    );
    if (caption) caption.cues.push(cue);
  }
  return merged;
}

/** Return cues which currently have no transcript interval to annotate. */
export function standaloneCues(
  segments: TranscriptSegment[],
  cues: AudioCue[],
): AudioCue[] {
  return cues.filter(
    (cue) =>
      !segments.some(
        (segment) => cue.start < segment.end && cue.end > segment.start,
      ),
  );
}

/** Merge a live cue update into React state without summing confidence. */
export function mergeAudioCue(cues: AudioCue[], incoming: AudioCue): AudioCue[] {
  const ordered = [...cues, incoming].sort((left, right) =>
    left.label.localeCompare(right.label) || left.start - right.start || left.end - right.end,
  );
  const merged: AudioCue[] = [];

  for (const cue of ordered) {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.label === cue.label &&
      previous.category === cue.category &&
      cue.start < previous.end
    ) {
      merged[merged.length - 1] = {
        ...previous,
        start: Math.min(previous.start, cue.start),
        end: Math.max(previous.end, cue.end),
        confidence: Math.max(previous.confidence, cue.confidence),
      };
    } else {
      merged.push(cue);
    }
  }

  return merged.sort((left, right) => left.start - right.start || left.end - right.end);
}
