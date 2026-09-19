"use client";

import { useEffect, useRef } from "react";
import type { Transcript } from "../captions/types";
import { CaptionLine } from "./CaptionLine";

type CaptionDisplayProps = {
  transcripts: Transcript[];
  interimTranscript: Transcript | null;
};

export function CaptionDisplay({ transcripts, interimTranscript }: CaptionDisplayProps) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [transcripts, interimTranscript?.text]);

  const hasCaptions = transcripts.length > 0 || interimTranscript !== null;

  return (
    <section
      ref={scrollContainerRef}
      aria-live="polite"
      aria-atomic="false"
      className="max-h-[55vh] space-y-4 overflow-y-auto"
    >
      {hasCaptions ? (
        <>
          {transcripts.map((transcript) => (
            <CaptionLine key={transcript.id} transcript={transcript} />
          ))}
          {interimTranscript ? (
            <CaptionLine key={interimTranscript.id} transcript={interimTranscript} />
          ) : null}
        </>
      ) : (
        <p className="py-10 text-center text-base text-slate-400">
          Captions will appear here when you start listening.
        </p>
      )}
    </section>
  );
}
