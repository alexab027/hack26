/**
 * Requests microphone permission and owns start/stop capture lifecycle.
 * It will expose live chunks to both Deepgram and the analysis backend.
 */
export async function requestMicrophone(): Promise<MediaStream> {
  // TODO: Select a supported recording format and provide cleanup/error handling.
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

