import type { AudioCue as AudioCueData, Transcript } from "../captions/types";
import {
  CAPTION_VOLUME_TEXT_CLASSES,
  type CaptionVolumeStyle,
} from "../captions/mergeCues";
import { AudioCue } from "./AudioCue";

type CaptionLineProps = {
  transcript: Transcript;
  cues?: AudioCueData[];
  volumeStyle?: CaptionVolumeStyle;
  speakerLabel?: string;
};

export function CaptionLine({
  transcript,
  cues = [],
  volumeStyle = "normal",
  speakerLabel,
}: CaptionLineProps) {
  return (
    <div
      className={`rounded-[1.125rem] border border-[#e1e5dc] bg-[var(--surface)] p-4 transition-opacity ${transcript.final ? "opacity-100" : "opacity-65"}`}
    >
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#567165]">
        {speakerLabel ?? `Speaker ${transcript.speaker}`}
      </p>
      <p
        className={`${CAPTION_VOLUME_TEXT_CLASSES[volumeStyle]} leading-[1.42] text-[var(--text-primary)]`}
      >
        {cues.map((cue) => (
          <AudioCue
            key={`${cue.category}-${cue.label}-${cue.start}-${cue.end}`}
            cue={cue}
          />
        ))}
        {transcript.text}
      </p>
    </div>
  );
}
