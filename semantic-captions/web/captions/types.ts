export type CueCategory = "prosody" | "emotion" | "environment";

export type Transcript = {
  id: string;
  text: string;
  speaker: number;
  start: number;
  end: number;
  confidence: number;
  final: boolean;
};

// These compatibility types keep older scaffold files compiling while the app is still
// intentionally frontend-only and no Deepgram integration has been added yet.
export type TranscriptSegment = {
  type: "transcript";
  start: number;
  end: number;
  text: string;
  speaker?: number;
  confidence: number;
  final: boolean;
};

export type AudioCue = {
  type: "audio_cue";
  start: number;
  end: number;
  category: CueCategory;
  label: string;
  confidence: number;
};

export type MergedCaption = TranscriptSegment & {
  cues: AudioCue[];
};
