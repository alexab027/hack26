import type { AudioCue, CueCategory } from "../captions/types";

const CONNECT_TIMEOUT_MS = 2500;
const CLOSE_TIMEOUT_MS = 5000;
const CUE_CATEGORIES: CueCategory[] = ["prosody", "emotion", "environment"];

export type SemanticStreamHandlers = {
  onCue(cue: AudioCue): void;
  onWarning(message: string): void;
};

export interface SemanticStream {
  readonly sampleRate: number;
  start(sessionId: string): void;
  stop(): void;
  close(): void;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function parseAudioCue(value: unknown): AudioCue | null {
  const cue = asRecord(value);
  if (
    !cue ||
    cue.type !== "audio_cue" ||
    typeof cue.start !== "number" ||
    typeof cue.end !== "number" ||
    cue.end <= cue.start ||
    typeof cue.label !== "string" ||
    typeof cue.confidence !== "number" ||
    cue.confidence < 0 ||
    cue.confidence > 1 ||
    !CUE_CATEGORIES.includes(cue.category as CueCategory)
  ) {
    return null;
  }
  return cue as AudioCue;
}

function waitForSocket(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Semantic backend connection timed out."));
    }, CONNECT_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("close", handleClose);
    };
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Could not connect to the semantic audio backend."));
    };
    const handleClose = () => {
      cleanup();
      reject(new Error("Semantic backend closed before audio started."));
    };
    socket.addEventListener("open", handleOpen);
    socket.addEventListener("error", handleError);
    socket.addEventListener("close", handleClose);
  });
}

/** Prepare a gated PCM branch; `start` establishes the shared session origin. */
export async function prepareSemanticStream(
  stream: MediaStream,
  url: string,
  handlers: SemanticStreamHandlers,
): Promise<SemanticStream> {
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_WS_URL is not configured.");

  const context = new AudioContext();
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";
  let source: MediaStreamAudioSourceNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  let mutedOutput: GainNode | null = null;
  let sending = false;
  let stopping = false;
  let closeFallback: number | null = null;

  const disconnectAudio = () => {
    sending = false;
    worklet?.disconnect();
    source?.disconnect();
    mutedOutput?.disconnect();
    worklet = null;
    source = null;
    mutedOutput = null;
    if (context.state !== "closed") void context.close();
  };

  try {
    await Promise.all([
      waitForSocket(socket),
      context.audioWorklet.addModule("/pcm-capture-processor.js"),
      context.resume(),
    ]);

    source = context.createMediaStreamSource(stream);
    worklet = new AudioWorkletNode(context, "pcm-capture-processor");
    mutedOutput = context.createGain();
    mutedOutput.gain.value = 0;
    source.connect(worklet);
    worklet.connect(mutedOutput);
    mutedOutput.connect(context.destination);

    worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!sending || socket.readyState !== WebSocket.OPEN) return;
      socket.send(event.data.buffer);
    };
  } catch (error) {
    disconnectAudio();
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "Semantic setup failed");
    }
    throw error;
  }

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      const payload: unknown = JSON.parse(event.data);
      const cue = parseAudioCue(payload);
      if (cue) {
        handlers.onCue(cue);
        return;
      }
      const control = asRecord(payload);
      if (control?.type === "semantic_error" && typeof control.message === "string") {
        handlers.onWarning(control.message);
      }
    } catch {
      console.warn("[Semantic] ignored a malformed backend message");
    }
  });

  socket.addEventListener("close", () => {
    if (closeFallback) window.clearTimeout(closeFallback);
    disconnectAudio();
    if (!stopping) handlers.onWarning("Semantic audio connection closed.");
  });

  socket.addEventListener("error", () => {
    if (!stopping) handlers.onWarning("Semantic audio connection failed.");
  });

  return {
    sampleRate: context.sampleRate,
    start(sessionId) {
      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error("Semantic backend is not connected.");
      }
      socket.send(
        JSON.stringify({ type: "start", sample_rate: context.sampleRate, session_id: sessionId }),
      );
      sending = true;
      worklet?.port.postMessage({ type: "start" });
      console.info(`[Semantic] streaming mono Float32 PCM at ${context.sampleRate} Hz`);
    },
    stop() {
      if (stopping) return;
      stopping = true;
      sending = false;
      worklet?.port.postMessage({ type: "stop" });
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "stop" }));
        closeFallback = window.setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN) socket.close(1000, "Client stopped");
        }, CLOSE_TIMEOUT_MS);
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "Client stopped");
      }
      disconnectAudio();
    },
    close() {
      stopping = true;
      if (closeFallback) window.clearTimeout(closeFallback);
      disconnectAudio();
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "Client stopped");
      }
    },
  };
}
