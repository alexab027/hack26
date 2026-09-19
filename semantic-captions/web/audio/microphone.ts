/**
 * Requests microphone permission and returns the browser MediaStream.
 * This is the base abstraction we can later reuse for Deepgram and backend audio analysis.
 */
export async function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("This browser does not support microphone access.");
  }

  // We intentionally keep this simple for now: just ask for audio input.
  // Later, we can decide on specific encodings or streaming formats when connecting to Deepgram.
  return navigator.mediaDevices.getUserMedia({
    audio: true,
  });
}

/**
 * Stops all tracks on a MediaStream so the browser releases the microphone hardware.
 */
export function stopMicrophone(stream: MediaStream | null | undefined): void {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * A small helper for the app state to start and cleanly manage the microphone capture lifecycle.
 */
export async function startMicrophoneCapture(): Promise<MediaStream> {
  return requestMicrophone();
}
