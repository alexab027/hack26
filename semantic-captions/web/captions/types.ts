export type CueCategory = "prosody" | "emotion" | "environment";

export type TranscriptSegment = {
  type: "transcript";
  start: number;
  end: number;
  text: string;
  speaker?: number;
  confidence: number;
  final: boolean;
};

export type Transcript = TranscriptSegment & {
  id: string;
  speaker: number;
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
