import type { Transcript } from "../captions/types";

type CaptionLineProps = {
  transcript: Transcript;
};

export function CaptionLine({ transcript }: CaptionLineProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-700 bg-slate-950/70 p-4 shadow-sm transition-opacity ${transcript.final ? "opacity-100" : "opacity-70"}`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
        Speaker {transcript.speaker}
      </p>
      <p className="text-2xl leading-relaxed text-white sm:text-[2rem]">{transcript.text}</p>
    </div>
  );
}
