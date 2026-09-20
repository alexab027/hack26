import {
  HumeClient,
  convertBlobToBase64,
  getBrowserSupportedMimeType,
} from "hume";
import type { Hume } from "hume";
import {
  HumeExpressionTracker,
  type HumeExpressionAlert,
} from "../emotion/humeAlerts";

const HUME_AUDIO_TIMESLICE_MS = 80;

export type HumeStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "unavailable";

export type HumeExpressionHandlers = {
  onStatus(status: HumeStatus): void;
  onAlert(alert: HumeExpressionAlert): void;
  onWarning(message: string): void;
};

export type HumeExpressionSession = {
  stop(): void;
};

type HumeTokenResponse = {
  accessToken: string;
  configId?: string;
};

export async function startHumeExpressionAnalysis(
  sharedStream: MediaStream,
  handlers: HumeExpressionHandlers,
): Promise<HumeExpressionSession> {
  handlers.onStatus("connecting");
  const { accessToken, configId } = await fetchHumeToken();
  const client = new HumeClient({ accessToken });
  const socket = client.empathicVoice.chat.connect({
    ...(configId ? { configId } : {}),
    reconnectAttempts: 0,
  });
  const tracker = new HumeExpressionTracker();
  let recorder: MediaRecorder | null = null;
  let stopped = false;
  let sendChain = Promise.resolve();

  const stopRecorder = () => {
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onerror = null;
    if (recorder.state !== "inactive") recorder.stop();
    recorder = null;
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    stopRecorder();
    socket.close();
    handlers.onStatus("disconnected");
    console.info("[Hume] disconnected");
  };

  const fail = (message: string) => {
    if (stopped) return;
    stopped = true;
    stopRecorder();
    socket.close();
    handlers.onStatus("unavailable");
    handlers.onWarning(message);
    console.info("[Hume] disconnected");
  };

  socket.on("message", (message) => {
    if (message.type === "audio_output") return;
    if (message.type === "error") {
      fail(`[${message.code}] ${message.message}`);
      return;
    }
    if (message.type !== "user_message" || message.interim) return;

    console.info("[Hume] user_message received");
    const scores = message.models.prosody?.scores;
    if (!scores) {
      console.info("[Hume] finalized utterance did not include prosody scores");
      return;
    }
    logExpressionScores(message.message.content ?? "", scores);
    const alert = tracker.update(scores);
    if (alert) handlers.onAlert(alert);
  });
  socket.on("error", (error) => {
    fail(safeErrorMessage(error));
  });
  socket.on("close", (event) => {
    if (stopped) return;
    stopped = true;
    stopRecorder();
    handlers.onStatus("unavailable");
    handlers.onWarning(`connection closed (code ${event.code})`);
    console.info("[Hume] disconnected");
  });

  try {
    await socket.waitForOpen();
    if (stopped) throw new Error("Hume session stopped before opening");

    socket.pauseAssistant();
    console.info("[Hume] connected");
    handlers.onStatus("connected");

    const mimeType = getBrowserSupportedMimeType();
    if (!mimeType.success) throw mimeType.error;

    // MediaRecorder does not own or stop these shared tracks. Only this recorder
    // and Hume socket are cleaned up when the sidecar ends.
    const humeStream = new MediaStream(sharedStream.getAudioTracks());
    recorder = new MediaRecorder(humeStream, { mimeType: mimeType.mimeType });
    recorder.ondataavailable = (event) => {
      if (!event.data.size || stopped) return;
      const chunk = event.data;
      sendChain = sendChain
        .then(async () => {
          if (stopped || socket.readyState !== WebSocket.OPEN) return;
          const data = await convertBlobToBase64(chunk);
          if (!stopped && socket.readyState === WebSocket.OPEN) {
            socket.sendAudioInput({ data });
          }
        })
        .catch((error: unknown) => {
          handlers.onWarning(`audio chunk failed: ${safeErrorMessage(error)}`);
        });
    };
    recorder.onerror = () => fail("microphone recorder failed");
    recorder.start(HUME_AUDIO_TIMESLICE_MS);
    console.info("[Hume] listening");
    return { stop };
  } catch (error) {
    if (!stopped) {
      stopped = true;
      if (recorder?.state !== "inactive") recorder?.stop();
      socket.close();
      handlers.onStatus("unavailable");
    }
    throw error;
  }
}

async function fetchHumeToken(): Promise<HumeTokenResponse> {
  const response = await fetch("/api/hume-token", {
    method: "POST",
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (
    !response.ok ||
    typeof data !== "object" ||
    data === null ||
    !("access_token" in data) ||
    typeof data.access_token !== "string" ||
    !data.access_token
  ) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `token request failed (${response.status})`;
    throw new Error(message);
  }
  return {
    accessToken: data.access_token,
    ...("config_id" in data && typeof data.config_id === "string"
      ? { configId: data.config_id }
      : {}),
  };
}

function logExpressionScores(
  transcript: string,
  scores: Hume.empathicVoice.EmotionScores,
): void {
  console.info(
    `[Hume] "${transcript}" Anger=${scores.anger.toFixed(2)} ` +
      `Sadness=${scores.sadness.toFixed(2)} Joy=${scores.joy.toFixed(2)} ` +
      `Excitement=${scores.excitement.toFixed(2)} Distress=${scores.distress.toFixed(2)}`,
  );
  const top = Object.entries(scores)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, score]) => `${formatExpressionName(label)} ${score.toFixed(2)}`)
    .join("\n");
  console.info(`[Hume] top expressions:\n${top}`);
}

function formatExpressionName(label: string): string {
  const spaced = label.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown Hume error";
}
