type ListeningButtonProps = {
  listening: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function ListeningButton({ listening, onToggle, disabled = false }: ListeningButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={listening}
      onClick={onToggle}
      disabled={disabled}
      className={`min-h-14 w-full rounded-2xl px-5 py-3.5 text-lg font-semibold transition focus:outline-none focus:ring-4 focus:ring-[var(--sage-medium)]/70 disabled:cursor-not-allowed disabled:opacity-50 ${
        listening
          ? "border border-[var(--sage)] bg-transparent text-[var(--forest)] hover:bg-[var(--sage-pale)]"
          : "bg-[var(--forest)] text-[var(--surface)] hover:bg-[var(--forest-dark)]"
      }`}
    >
      {listening ? "Stop Listening" : "Start Listening"}
    </button>
  );
}
