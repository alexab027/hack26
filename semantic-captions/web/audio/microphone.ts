/**
 * Helpers for requesting and releasing browser microphone access.
 * This step intentionally remains frontend-only and does not connect to Deepgram.
 */

export async function startMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("This browser does not support microphone access.");
  }

  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function stopMicrophone(stream: MediaStream | null | undefined): void {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}
