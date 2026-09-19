/** Coordinates fan-out of each microphone chunk to transcription and analysis. */
export type AudioChunkConsumer = (chunk: Blob) => void | Promise<void>;

export function distributeAudioChunk(chunk: Blob, consumers: AudioChunkConsumer[]): void {
  // TODO: Add backpressure, failure isolation, timestamps, and consumer lifecycle handling.
  for (const consume of consumers) void consume(chunk);
}

