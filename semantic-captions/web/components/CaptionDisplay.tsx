import type { Transcript } from "../captions/types";
import { CaptionLine } from "./CaptionLine";

type CaptionDisplayProps = {
  transcripts: Transcript[];
};

export function CaptionDisplay({ transcripts }: CaptionDisplayProps) {
  return (
    <section aria-live="polite" aria-atomic="false" className="space-y-4">
      {transcripts.map((transcript) => (
        <CaptionLine key={transcript.id} transcript={transcript} />
      ))}
    </section>
  );
}
