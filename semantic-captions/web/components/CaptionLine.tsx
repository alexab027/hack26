import type { MergedCaption } from "../captions/types";
import { AudioCue } from "./AudioCue";

/** Renders one transcript segment and its timestamp-associated audio cues. */
export function CaptionLine({ caption }: { caption: MergedCaption }) {
  // TODO: Define visual treatment for speakers, interim text, and cue confidence.
  return <p>{caption.cues.map((cue) => <AudioCue key={`${cue.start}-${cue.label}`} cue={cue} />)} {caption.text}</p>;
}

