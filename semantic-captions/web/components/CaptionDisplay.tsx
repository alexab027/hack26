"use client";

import { useEffect, useRef } from "react";
import { mergeCues, standaloneCues } from "../captions/mergeCues";
import type { AudioCue as AudioCueData, Transcript } from "../captions/types";
import { AudioCue } from "./AudioCue";
import { CaptionLine } from "./CaptionLine";

type CaptionDisplayProps = {
  transcripts: Transcript[];
  interimTranscript?: Transcript | null;
  interimTranscripts?: Transcript[];
  audioCues?: AudioCueData[];
  speakerLabel?: string;
  emptyMessage?: string;
};

export function CaptionDisplay({
  transcripts,
  interimTranscript,
  interimTranscripts,
  audioCues = [],
  speakerLabel,
  emptyMessage = "Start listening and your captions will appear here.",
}: CaptionDisplayProps) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const activeInterimTranscripts =
    interimTranscripts ?? (interimTranscript ? [interimTranscript] : []);
  const transcriptTimeline = [...transcripts, ...activeInterimTranscripts];
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
  }, [transcripts, interimTranscript?.text, interimTranscripts, audioCues]);

  const hasCaptions = timeline.length > 0;

  return (
    <section
      ref={scrollContainerRef}
      aria-live="polite"
      aria-atomic="false"
      className="max-h-[56svh] space-y-3 overflow-y-auto pr-0.5"
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
                className="rounded-[1.125rem] border border-[#e1e5dc] bg-[var(--surface)] p-4 text-[1.25rem] leading-relaxed"
              >
                <AudioCue cue={item.cue} />
              </div>
            ),
          )}
        </>
      ) : (
        <div className="flex min-h-[34svh] flex-col items-center justify-center px-5 py-10 text-center">
          <span aria-hidden="true" className="text-3xl text-[var(--sage)]">[ ]</span>
          <p className="mt-3 text-base font-semibold text-[var(--forest)]">No captions yet</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-[var(--text-secondary)]">
            {emptyMessage}
          </p>
        </div>
      )}
    </section>
  );
}
