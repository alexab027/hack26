type StatusIndicatorProps = {
  isListening: boolean;
};

export function StatusIndicator({ isListening }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${
          isListening ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" : "bg-slate-500"
        }`}
      />
      <span aria-live="polite">{isListening ? "Listening..." : "Not listening"}</span>
    </div>
  );
}
