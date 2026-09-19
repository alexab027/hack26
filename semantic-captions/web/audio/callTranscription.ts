import type { RemoteAudioTrack } from "livekit-client";
import { connectToDeepgram, type DeepgramConnection } from "./deepgram";
import { getSupportedRecordingMimeType } from "./microphone";
import type { Transcript } from "../captions/types";

const AUDIO_CHUNK_MS = 250;

type CallTranscriptionHandlers = {
  onStarted: () => void;
  onTranscript: (transcript: Transcript) => void;
  onError: (message: string) => void;
};

export type CallTranscriptionSession = {
  stop: () => void;
};

async function getDeepgramToken(signal: AbortSignal): Promise<string> {
  const response = await fetch("/api/deepgram-token", {
    method: "POST",
    signal,
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    throw new Error("Could not start caller captions.");
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("access_token" in body) ||
    typeof body.access_token !== "string" ||
    !body.access_token
  ) {
    throw new Error("The Deepgram token response was invalid.");
  }

  return body.access_token;
}

export async function startCallTranscription(
  remoteTrack: RemoteAudioTrack,
  signal: AbortSignal,
  handlers: CallTranscriptionHandlers,
): Promise<CallTranscriptionSession> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot record the caller audio for captions.");
  }

  const mimeType = getSupportedRecordingMimeType();
  if (!mimeType) {
    throw new Error("This browser has no compatible caption audio format.");
  }

  const token = await getDeepgramToken(signal);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  // A MediaStream may reference the same incoming track as LiveKit's normal
  // audio renderer. Recording this stream does not detach or stop playback.
  const callerStream = new MediaStream([remoteTrack.mediaStreamTrack]);
  const recorder = new MediaRecorder(callerStream, { mimeType });
  let connection: DeepgramConnection | null = null;
  let stopped = false;
  let sentFirstChunk = false;

  const fail = (message: string) => {
    if (stopped) return;
    stopped = true;
    if (recorder.state !== "inactive") recorder.stop();
    connection?.close();
    handlers.onError(message);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;

    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      connection?.close();
    }
    console.info("[Call Transcription] Stopped");
  };

  recorder.ondataavailable = (event) => {
    if (stopped || !event.data || event.data.size === 0) return;
    if (connection?.sendAudio(event.data) && !sentFirstChunk) {
      sentFirstChunk = true;
      console.info("[Call Transcription] Audio streaming");
    }
  };
  recorder.onstop = () => {
    connection?.finish();
  };
  recorder.onerror = () => {
    fail("Caller audio recording failed.");
  };

  connection = connectToDeepgram(token, {
    onOpen: () => {
      if (stopped || signal.aborted) {
        connection?.close();
        return;
      }

      try {
        recorder.start(AUDIO_CHUNK_MS);
        handlers.onStarted();
      } catch {
        fail("Could not start caller captions.");
      }
    },
    onError: () => {
      fail("Could not connect caller captions.");
    },
    onClose: () => {
      fail("Caller captions disconnected.");
    },
    onTranscript: handlers.onTranscript,
  });

  signal.addEventListener("abort", stop, { once: true });

  return { stop };
}
