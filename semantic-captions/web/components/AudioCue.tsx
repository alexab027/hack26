import type { AudioCue as AudioCueData } from "../captions/types";

/** Renders an audible-context label such as voice trembling or car horn. */
export function AudioCue({ cue }: { cue: AudioCueData }) {
  return (
    <span
      aria-label={`${cue.category}: ${cue.label}`}
      className="mr-2 inline-block rounded-full border border-[#ccd7c8] bg-[var(--sage-light)] px-2.5 py-0.5 align-[0.1em] text-[0.72em] font-semibold leading-relaxed text-[#456052]"
    >
      [ {cue.label.replaceAll("_", " ")} ]
    </span>
  );
}
