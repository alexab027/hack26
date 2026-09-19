/** Accessible control for starting and stopping microphone capture. */
export function ListeningButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  // TODO: Connect this control to microphone permission and stream lifecycle state.
  return <button type="button" aria-pressed={listening} onClick={onToggle}>{listening ? "Stop listening" : "Start listening"}</button>;
}

