/** Shared client-side shapes corresponding to the language-neutral event contract. */
export type CueCategory = "prosody" | "emotion" | "environment";

export interface TranscriptSegment {
  type: "transcript";
  start: number;
  end: number;
  text: string;
  speaker?: number;
  confidence: number;
  final: boolean;
}

export interface AudioCue {
  type: "audio_cue";
  start: number;
  end: number;
  category: CueCategory;
  label: string;
  confidence: number;
}

export interface MergedCaption extends TranscriptSegment {
  cues: AudioCue[];
}

// TODO: Add runtime validation at network boundaries so malformed events fail safely.

