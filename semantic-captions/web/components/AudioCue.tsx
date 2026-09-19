import type { AudioCue as AudioCueData } from "../captions/types";

/** Renders an audible-context label such as voice trembling or car horn. */
export function AudioCue({ cue }: { cue: AudioCueData }) {
  // TODO: Map labels to readable text/icons without relying on color alone.
  return <span aria-label={`${cue.category}: ${cue.label}`}>[{cue.label.replaceAll("_", " ")}]</span>;
}

