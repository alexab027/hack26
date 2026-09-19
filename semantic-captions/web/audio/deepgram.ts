/** Owns the live Deepgram transport; Deepgram itself performs speech recognition. */
export interface DeepgramConnection {
  send(chunk: Blob): void;
  close(): void;
}

export function connectToDeepgram(_token: string): DeepgramConnection {
  // TODO: Open the streaming API, send audio, and emit interim/final raw events.
  throw new Error("Deepgram streaming is not implemented.");
}

