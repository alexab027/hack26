"use client";

import { useEffect, useRef } from "react";
import { mergeCues, standaloneCues } from "../captions/mergeCues";
import type { AudioCue as AudioCueData, Transcript } from "../captions/types";
import { AudioCue } from "./AudioCue";
import { CaptionLine } from "./CaptionLine";

type CaptionDisplayProps = {
  transcripts: Transcript[];
  interimTranscript: Transcript | null;
  audioCues?: AudioCueData[];
  speakerLabel?: string;
  emptyMessage?: string;
};

export function CaptionDisplay({
  transcripts,
  interimTranscript,
  audioCues = [],
  speakerLabel,
  emptyMessage = "Captions will appear here when you start listening.",
}: CaptionDisplayProps) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const transcriptTimeline = interimTranscript
    ? [...transcripts, interimTranscript]
    : transcripts;
  const mergedCaptions = mergeCues(transcriptTimeline, audioCues);
  const unassociatedCues = standaloneCues(transcriptTimeline, audioCues);
  const timeline = [
    ...mergedCaptions.map((caption) => ({
      kind: "transcript" as const,
      start: caption.start,
      key: caption.id,
      caption,
    })),
    ...unassociatedCues.map((cue) => ({
      kind: "cue" as const,
      start: cue.start,
      key: `${cue.category}-${cue.label}-${cue.start}`,
      cue,
    })),
  ].sort((left, right) => left.start - right.start);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [transcripts, interimTranscript?.text, audioCues]);

  const hasCaptions = timeline.length > 0;

  return (
    <section
      ref={scrollContainerRef}
      aria-live="polite"
      aria-atomic="false"
      className="max-h-[55vh] space-y-4 overflow-y-auto"
    >
      {hasCaptions ? (
        <>
          {timeline.map((item) =>
            item.kind === "transcript" ? (
              <CaptionLine
                key={item.key}
                transcript={item.caption}
                cues={item.caption.cues}
                speakerLabel={speakerLabel}
              />
            ) : (
              <div
                key={item.key}
                className="rounded-2xl border border-amber-500/40 bg-slate-950/70 p-4 text-2xl leading-relaxed"
              >
                <AudioCue cue={item.cue} />
              </div>
            ),
          )}
        </>
      ) : (
        <p className="py-10 text-center text-base text-slate-400">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
