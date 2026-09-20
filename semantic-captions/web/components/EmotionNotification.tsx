import type { HumeExpressionAlert } from "../emotion/humeAlerts";

const ALERT_STYLES: Record<HumeExpressionAlert["label"], string> = {
  angry_sounding: "border-rose-400/70 bg-rose-950/95 text-rose-100",
  sad_sounding: "border-sky-400/70 bg-sky-950/95 text-sky-100",
  positive_sounding:
    "border-emerald-400/70 bg-emerald-950/95 text-emerald-100",
  emotional_shift: "border-amber-400/70 bg-amber-950/95 text-amber-100",
};

export function EmotionNotification({
  alert,
}: {
  alert: HumeExpressionAlert | null;
}) {
  if (!alert) return null;
  return (
    <aside
      aria-live="polite"
      aria-label="Vocal context"
      className={`mx-2 mb-3 rounded-2xl border px-4 py-3 shadow-lg ${ALERT_STYLES[alert.label]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider opacity-75">
        Vocal context
      </p>
      <p className="mt-1 text-base font-semibold">{alert.message}</p>
    </aside>
  );
}
