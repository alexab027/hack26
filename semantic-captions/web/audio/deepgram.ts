import {
  normalizeDeepgramTranscript,
  normalizeDiarizedDeepgramTranscripts,
} from "../captions/transcript";
import type { Transcript } from "../captions/types";

const DEEPGRAM_LIVE_URL = "wss://api.deepgram.com/v1/listen";

export type DeepgramConnectionHandlers = {
  onOpen(): void;
  onError(): void;
  onClose(event: CloseEvent): void;
  onTranscript?(transcript: Transcript): void;
  onTranscripts?(transcripts: Transcript[]): void;
};

export type DeepgramConnectionOptions = {
  speakerDiarization?: boolean;
};

export interface DeepgramConnection {
  readonly socket: WebSocket;
  sendAudio(chunk: Blob): boolean;
  finish(): void;
  close(): void;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function rawSpeakerIds(result: Record<string, unknown>): number[] {
  const channel = asRecord(result.channel);
  const alternatives = channel?.alternatives;
  const firstAlternative = Array.isArray(alternatives) ? asRecord(alternatives[0]) : null;
  const words = firstAlternative?.words;
  if (!Array.isArray(words)) return [];

  return [
    ...new Set(
      words.flatMap((value) => {
        const word = asRecord(value);
        return typeof word?.speaker === "number" && Number.isInteger(word.speaker)
          ? [word.speaker]
          : [];
      }),
    ),
  ].sort((left, right) => left - right);
}

function handleMessage(
  event: MessageEvent,
  handlers: DeepgramConnectionHandlers,
  options: DeepgramConnectionOptions,
) {
  if (typeof event.data !== "string") return;

  let message: unknown;
  try {
    message = JSON.parse(event.data);
  } catch {
    console.warn("[Deepgram] ignored a malformed JSON message");
    return;
  }

  const result = asRecord(message);
  if (!result) return;

  if (options.speakerDiarization && result.type === "Results") {
    const speakers = rawSpeakerIds(result);
    console.info(
      `[Diarization] raw speaker IDs: ${speakers.length > 0 ? speakers.join(", ") : "none"}`,
    );
  }

  const transcripts = options.speakerDiarization
    ? normalizeDiarizedDeepgramTranscripts(result)
    : [normalizeDeepgramTranscript(result)].filter(
        (transcript): transcript is Transcript => transcript !== null,
      );
  if (transcripts.length > 0) {
    for (const transcript of transcripts) {
      console.info(
        `[Deepgram] ${transcript.final ? "final" : "interim"} speaker=${transcript.speaker}: ${transcript.text}`,
      );
    }
    if (handlers.onTranscripts) {
      handlers.onTranscripts(transcripts);
    } else if (handlers.onTranscript) {
      for (const transcript of transcripts) handlers.onTranscript(transcript);
    }
    return;
  }

  if (result.type === "Error") {
    const code = typeof result.code === "string" ? result.code.slice(0, 80) : "unknown";
    const description =
      typeof result.description === "string"
        ? result.description.replace(/[^\x20-\x7E]/g, "").slice(0, 160)
        : "No description provided";
    console.error(`[Deepgram] error ${code}: ${description}`);
  }
}

export function connectToDeepgram(
  token: string,
  handlers: DeepgramConnectionHandlers,
  options: DeepgramConnectionOptions = {},
): DeepgramConnection {
  if (!token) {
    throw new Error("A temporary Deepgram token is required.");
  }

  const url = new URL(DEEPGRAM_LIVE_URL);
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("interim_results", "true");
  url.searchParams.set("smart_format", "true");
  if (options.speakerDiarization) {
    // Deepgram continues to support this streaming-specific v1 diarizer path.
    // Keep it scoped to Nearby; call transcription uses the default options.
    url.searchParams.set("diarize", "true");
  }

  // Browsers cannot set WebSocket Authorization headers. Deepgram accepts a
  // temporary JWT as the `bearer` Sec-WebSocket-Protocol pair instead.
  const socket = new WebSocket(url, ["bearer", token]);
  let closeFallback: ReturnType<typeof setTimeout> | null = null;

  socket.addEventListener("open", () => {
    console.info("[Deepgram] connected");
    handlers.onOpen();
  });

  socket.addEventListener("error", () => {
    console.error("[Deepgram] connection error");
    handlers.onError();
  });

  socket.addEventListener("message", (event) => handleMessage(event, handlers, options));

  socket.addEventListener("close", (event) => {
    if (closeFallback) clearTimeout(closeFallback);
    const safeReason = event.reason.replace(/[^\x20-\x7E]/g, "").slice(0, 160);
    console.info("[Deepgram] disconnected", {
      code: event.code,
      reason: safeReason || "No reason provided",
    });
    handlers.onClose(event);
  });

  return {
    socket,
    sendAudio(chunk) {
      if (chunk.size === 0 || socket.readyState !== WebSocket.OPEN) return false;

      socket.send(chunk);
      console.info(`[Deepgram] sending audio chunk: ${chunk.size} bytes`);
      return true;
    },
    finish() {
      if (socket.readyState !== WebSocket.OPEN) {
        if (socket.readyState === WebSocket.CONNECTING) socket.close();
        return;
      }

      socket.send(JSON.stringify({ type: "CloseStream" }));
      closeFallback = setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) socket.close(1000, "Client stopped");
      }, 1000);
    },
    close() {
      if (closeFallback) clearTimeout(closeFallback);
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "Client stopped");
      }
    },
  };
}
