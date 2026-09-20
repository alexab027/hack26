import type { RemoteAudioTrack } from "livekit-client";
import type { AudioCue } from "../captions/types";
import { prepareSemanticStream, type SemanticStream } from "./semanticStream";

export type CallSemanticSession = {
  stop(): void;
};

export type CallSemanticHandlers = {
  onCue(cue: AudioCue): void;
};

function createSessionId(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `call-semantic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Analyze a caller track as an optional sidecar without taking ownership of it.
 * The returned cleanup removes the track from our wrapper but never stops it.
 */
export async function startCallSemanticAnalysis(
  remoteTrack: RemoteAudioTrack,
  signal: AbortSignal,
  handlers: CallSemanticHandlers,
): Promise<CallSemanticSession | null> {
  const sharedTrack = remoteTrack.mediaStreamTrack;
  const callerStream = new MediaStream([sharedTrack]);
  const semanticUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "";
  let semanticStream: SemanticStream | null = null;
  let stopped = false;

  const detachSharedTrack = () => {
    if (callerStream.getTracks().includes(sharedTrack)) {
      callerStream.removeTrack(sharedTrack);
    }
  };

  try {
    semanticStream = await prepareSemanticStream(callerStream, semanticUrl, {
      onCue: (cue) => {
        console.info(
          `[Call Semantic] ${cue.label} ${cue.start.toFixed(2)}-${cue.end.toFixed(2)} confidence=${cue.confidence.toFixed(3)}`,
          cue,
        );
        handlers.onCue(cue);
      },
      onWarning: (message) => {
        console.warn(`[Call Semantic] ${message}`);
      },
    });
  } catch (error) {
    detachSharedTrack();
    if (!signal.aborted) {
      console.warn("[Call Semantic] unavailable", error);
    }
    return null;
  }

  if (signal.aborted) {
    semanticStream.close();
    detachSharedTrack();
    return null;
  }

  try {
    semanticStream.start(createSessionId());
    console.info(`[Call Semantic] connected at ${semanticStream.sampleRate} Hz`);
  } catch (error) {
    semanticStream.close();
    detachSharedTrack();
    console.warn("[Call Semantic] unavailable", error);
    return null;
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    signal.removeEventListener("abort", stop);
    semanticStream?.stop();
    semanticStream = null;
    detachSharedTrack();
    console.info("[Call Semantic] stopped");
  };

  signal.addEventListener("abort", stop, { once: true });
  return { stop };
}
