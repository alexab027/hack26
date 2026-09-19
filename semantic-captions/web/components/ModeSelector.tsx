export type AppMode = "nearby" | "call";

type ModeSelectorProps = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
  disabled?: boolean;
};

export function ModeSelector({
  mode,
  onChange,
  disabled = false,
}: ModeSelectorProps) {
  return (
    <div
      aria-label="Choose app mode"
      className="grid grid-cols-2 rounded-xl bg-slate-950 p-1"
    >
      {(["nearby", "call"] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 ${
            mode === option
              ? "bg-sky-500 text-white"
              : "text-slate-300 hover:text-white"
          }`}
        >
          {option === "nearby" ? "Nearby" : "Call"}
        </button>
      ))}
    </div>
  );
}
