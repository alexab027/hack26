import type { MergedCaption } from "../captions/types";
import { CaptionLine } from "./CaptionLine";

/** Displays the ordered, live-updating caption timeline. */
export function CaptionDisplay({ captions }: { captions: MergedCaption[] }) {
  // TODO: Add automatic scrolling and announce final captions accessibly.
  return <section aria-live="polite">{captions.map((caption) => <CaptionLine key={`${caption.start}-${caption.text}`} caption={caption} />)}</section>;
}

