import type { AudioCue as AudioCueData, Transcript } from "../captions/types";
import { AudioCue } from "./AudioCue";

type CaptionLineProps = {
  transcript: Transcript;
  cues?: AudioCueData[];
};

export function CaptionLine({ transcript, cues = [] }: CaptionLineProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-700 bg-slate-950/70 p-4 shadow-sm transition-opacity ${transcript.final ? "opacity-100" : "opacity-70"}`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
        Speaker {transcript.speaker}
      </p>
      <p className="text-2xl leading-relaxed text-white sm:text-[2rem]">
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
