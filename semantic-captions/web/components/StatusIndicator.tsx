/** Communicates microphone, transcription, and backend connection state. */
export function StatusIndicator({ message }: { message: string }) {
  // TODO: Replace the single message with typed service states and recovery guidance.
  return <p role="status">{message}</p>;
}

