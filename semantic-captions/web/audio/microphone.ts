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

const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
] as const;

export function getSupportedRecordingMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;

  return RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function stopMicrophone(stream: MediaStream | null | undefined): void {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}
