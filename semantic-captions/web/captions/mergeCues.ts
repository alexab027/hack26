import type { AudioCue, MergedCaption, TranscriptSegment } from "./types";

export type CaptionVolumeStyle =
  | "xsmall"
  | "small"
  | "normal"
  | "large"
  | "xlarge";

export const CAPTION_VOLUME_TEXT_CLASSES: Record<CaptionVolumeStyle, string> = {
  xsmall: "text-xs",
  small: "text-base",
  normal: "text-xl",
  large: "text-2xl",
  xlarge: "text-3xl",
};

export function isVolumeStyleCue(cue: AudioCue): boolean {
  return (
    cue.category === "prosody" &&
    (cue.label === "volume_xsmall" ||
      cue.label === "volume_small" ||
      cue.label === "volume_large" ||
      cue.label === "volume_xlarge")
  );
}

export function partitionAudioCues(cues: AudioCue[]): {
  volumeCues: AudioCue[];
  visibleCues: AudioCue[];
} {
  return {
    volumeCues: cues.filter(isVolumeStyleCue),
    visibleCues: cues.filter((cue) => !isVolumeStyleCue(cue)),
  };
}

/** Choose the style with the greatest total overlap for one transcript segment. */
export function volumeStyleForSegment(
  segment: TranscriptSegment,
  cues: AudioCue[],
): CaptionVolumeStyle {
  const overlapByStyle: Record<CaptionVolumeStyle, number> = {
    xsmall: 0,
    small: 0,
    normal: 0,
    large: 0,
    xlarge: 0,
  };

  for (const cue of cues) {
    if (!isVolumeStyleCue(cue)) continue;
    const overlap = Math.max(
      0,
      Math.min(segment.end, cue.end) - Math.max(segment.start, cue.start),
    );
    const style = cue.label.replace("volume_", "") as CaptionVolumeStyle;
    overlapByStyle[style] += overlap;
  }

  const styledStates: CaptionVolumeStyle[] = [
    "xsmall",
    "small",
    "large",
    "xlarge",
  ];
  if (styledStates.every((style) => overlapByStyle[style] === 0)) return "normal";
  return styledStates.reduce<CaptionVolumeStyle>(
    (selected, candidate) =>
      overlapByStyle[candidate] >= overlapByStyle[selected] ? candidate : selected,
    "normal",
  );
}

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
