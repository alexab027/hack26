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
      className="grid grid-cols-2 rounded-2xl border border-[#dce3d8] bg-[var(--sage-pale)] p-1"
    >
      {(["nearby", "call"] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
          className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 focus:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50 ${
            mode === option
              ? "bg-[var(--forest)] text-[var(--surface)] shadow-sm"
              : "text-[#617168] hover:bg-[var(--sage-light)] hover:text-[var(--forest)]"
          }`}
        >
          {option === "nearby" ? "Nearby" : "Call"}
        </button>
      ))}
    </div>
  );
}
