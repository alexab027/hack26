import type { AudioCue } from "../captions/types";

const ALERT_PRESENTATION: Record<
  string,
  { text: string; className: string }
> = {
  angry_sounding: {
    text: "Angry-sounding speech detected",
    className: "border-rose-400/70 bg-rose-950/90 text-rose-100",
  },
  sad_sounding: {
    text: "Sad-sounding speech detected",
    className: "border-sky-400/70 bg-sky-950/90 text-sky-100",
  },
  positive_sounding: {
    text: "Positive vocal expression detected",
    className: "border-emerald-400/70 bg-emerald-950/90 text-emerald-100",
  },
  emotional_shift: {
    text: "Possible emotional shift detected",
    className: "border-amber-400/70 bg-amber-950/90 text-amber-100",
  },
};

export function EmotionAlerts({ cues }: { cues: AudioCue[] }) {
  const alerts = cues.flatMap((cue) => {
    const presentation = ALERT_PRESENTATION[cue.label];
    return presentation ? [{ cue, presentation }] : [];
  });
  if (alerts.length === 0) return null;

  return (
    <aside aria-label="Vocal expression notifications" className="space-y-2 px-2 pb-3">
      {alerts.map(({ cue, presentation }) => (
        <div
          key={`${cue.label}-${cue.start}-${cue.end}`}
          role="status"
          className={`rounded-2xl border px-4 py-3 shadow-lg ${presentation.className}`}
        >
          <p className="text-base font-semibold">{presentation.text}</p>
          <p className="mt-1 text-xs opacity-75">
            Vocal-expression estimate · {Math.round(cue.confidence * 100)}%
          </p>
        </div>
      ))}
    </aside>
  );
}
