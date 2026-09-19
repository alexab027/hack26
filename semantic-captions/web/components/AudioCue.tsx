import type { AudioCue as AudioCueData } from "../captions/types";

/** Renders an audible-context label such as voice trembling or car horn. */
export function AudioCue({ cue }: { cue: AudioCueData }) {
  return (
    <span
      aria-label={`${cue.category}: ${cue.label}`}
      className="mr-2 inline-block font-semibold text-amber-300"
    >
      [{cue.label.replaceAll("_", " ")}]
    </span>
  );
}
