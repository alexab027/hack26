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
      className={`w-full rounded-2xl px-5 py-5 text-xl font-semibold transition focus:outline-none focus:ring-4 focus:ring-sky-400/60 ${
        listening
          ? "bg-slate-100 text-slate-900 hover:bg-white"
          : "bg-sky-500 text-white hover:bg-sky-400"
      }`}
    >
      {listening ? "Stop Listening" : "Start Listening"}
    </button>
  );
}
