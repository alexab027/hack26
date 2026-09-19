/** Maintains short overlapping (roughly 1–3 second) windows for backend analysis. */
export class AudioWindowBuffer {
  // TODO: Define sample/time-based window boundaries and emit timestamped windows.
  add(_chunk: Blob): void {
    throw new Error("Audio window buffering is not implemented.");
  }
}

