type StatusIndicatorProps = {
  isListening: boolean;
  errorMessage?: string | null;
};

export function StatusIndicator({ isListening, errorMessage }: StatusIndicatorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#456052]">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${
            isListening ? "bg-[var(--status-active)]" : "bg-[var(--status-idle)]"
          }`}
        />
        <span aria-live="polite">{isListening ? "Listening" : "Ready"}</span>
      </div>

      {errorMessage ? (
        <p className="error-panel" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
