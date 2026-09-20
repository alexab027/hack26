"use client";

import { useEffect, useRef, useState } from "react";
import { BrandHeader } from "../components/BrandHeader";
import { CaptionDisplay } from "../components/CaptionDisplay";
import { EmotionAlerts } from "../components/EmotionAlerts";
import { EmotionNotification } from "../components/EmotionNotification";
import { CallLanding } from "../components/call/CallLanding";
import { ListeningButton } from "../components/ListeningButton";
import { ModeSelector, type AppMode } from "../components/ModeSelector";
import { StatusIndicator } from "../components/StatusIndicator";
import { mergeAudioCue } from "../captions/mergeCues";
import type { AudioCue, Transcript } from "../captions/types";
import {
  getSupportedRecordingMimeType,
  startMicrophone,
  stopMicrophone,
} from "../audio/microphone";
import { connectToDeepgram, type DeepgramConnection } from "../audio/deepgram";
import {
  prepareSemanticStream,
  type SemanticStream,
} from "../audio/semanticStream";
import {
  startHumeExpressionAnalysis,
  type HumeExpressionSession,
} from "../audio/humeExpression";
import type { HumeExpressionAlert } from "../emotion/humeAlerts";

const AUDIO_CHUNK_MS = 250;
const MAX_FINAL_CAPTIONS = 100;
const MAX_SEMANTIC_CUES = 200;
const MAX_EMOTION_ALERTS = 3;
const EMOTION_ALERT_DURATION_MS = 6000;
const HUME_ALERT_DURATION_MS = 4000;

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>("nearby");
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const deepgramConnectionRef = useRef<DeepgramConnection | null>(null);
  const semanticStreamRef = useRef<SemanticStream | null>(null);
  const emotionAlertTimersRef = useRef<number[]>([]);
  const humeSessionRef = useRef<HumeExpressionSession | null>(null);
  const humeAlertTimerRef = useRef<number | null>(null);
  const deepgramAttemptRef = useRef(0);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [finalCaptions, setFinalCaptions] = useState<Transcript[]>([]);
  const [interimCaptions, setInterimCaptions] = useState<Transcript[]>([]);
  const [audioCues, setAudioCues] = useState<AudioCue[]>([]);
  const [emotionAlerts, setEmotionAlerts] = useState<AudioCue[]>([]);
  const [humeAlert, setHumeAlert] = useState<HumeExpressionAlert | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      deepgramAttemptRef.current += 1;
      deepgramConnectionRef.current?.close();
      deepgramConnectionRef.current = null;
      semanticStreamRef.current?.close();
      semanticStreamRef.current = null;
      humeSessionRef.current?.stop();
      humeSessionRef.current = null;
      if (humeAlertTimerRef.current !== null) {
        window.clearTimeout(humeAlertTimerRef.current);
        humeAlertTimerRef.current = null;
      }
      for (const timer of emotionAlertTimersRef.current) window.clearTimeout(timer);
      emotionAlertTimersRef.current = [];
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        recorder.onstart = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      recorderRef.current = null;
      stopMicrophone(microphoneStreamRef.current);
      microphoneStreamRef.current = null;
    };
  }, []);

  const stopAfterDeepgramFailure = (attempt: number, message: string) => {
    if (!mountedRef.current || deepgramAttemptRef.current !== attempt) return;

    deepgramAttemptRef.current += 1;
    const connection = deepgramConnectionRef.current;
    deepgramConnectionRef.current = null;
    connection?.close();
    semanticStreamRef.current?.close();
    semanticStreamRef.current = null;
    humeSessionRef.current?.stop();
    humeSessionRef.current = null;
    setHumeAlert(null);
    if (humeAlertTimerRef.current !== null) {
      window.clearTimeout(humeAlertTimerRef.current);
      humeAlertTimerRef.current = null;
    }
    setErrorMessage(message);
    setInterimCaptions([]);
    setEmotionAlerts([]);
    for (const timer of emotionAlertTimersRef.current) window.clearTimeout(timer);
    emotionAlertTimersRef.current = [];

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stopMicrophone(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
    setIsListening(false);
    busyRef.current = false;
    setIsBusy(false);
  };

  const handleToggleListening = async () => {
    if (busyRef.current) return;
    if (isListening) {
      busyRef.current = true;
      setIsBusy(true);
      deepgramAttemptRef.current += 1;
      setInterimCaptions([]);
      setEmotionAlerts([]);
      for (const timer of emotionAlertTimersRef.current) window.clearTimeout(timer);
      emotionAlertTimersRef.current = [];
      humeSessionRef.current?.stop();
      humeSessionRef.current = null;
      setHumeAlert(null);
      if (humeAlertTimerRef.current !== null) {
        window.clearTimeout(humeAlertTimerRef.current);
        humeAlertTimerRef.current = null;
      }
      semanticStreamRef.current?.stop();
      semanticStreamRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        const connection = deepgramConnectionRef.current;
        deepgramConnectionRef.current = null;
        connection?.finish();
        busyRef.current = false;
        setIsBusy(false);
      }
      // The final dataavailable event is delivered before onstop assembles the Blob.
      stopMicrophone(microphoneStreamRef.current);
      microphoneStreamRef.current = null;
      setIsListening(false);
      return;
    }

    busyRef.current = true;
    setIsBusy(true);
    setErrorMessage(null);
    setFinalCaptions([]);
    setInterimCaptions([]);
    setAudioCues([]);
    setEmotionAlerts([]);
    for (const timer of emotionAlertTimersRef.current) window.clearTimeout(timer);
    emotionAlertTimersRef.current = [];
    setHumeAlert(null);
    if (humeAlertTimerRef.current !== null) {
      window.clearTimeout(humeAlertTimerRef.current);
      humeAlertTimerRef.current = null;
    }
    try {
      if (typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support debug audio recording.");
      }
      const stream = await startMicrophone();
      if (!mountedRef.current) {
        stopMicrophone(stream);
        return;
      }
      microphoneStreamRef.current = stream;
      const attempt = deepgramAttemptRef.current + 1;
      deepgramAttemptRef.current = attempt;
      console.info("[Audio Debug] Microphone stream acquired", {
        audioTrackCount: stream.getAudioTracks().length,
        tracks: stream.getAudioTracks().map((track) => ({ enabled: track.enabled, readyState: track.readyState })),
      });
      const mimeType = getSupportedRecordingMimeType();
      if (!mimeType) {
        throw new Error("This browser does not support a compatible audio recording format.");
      }
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.onstart = () => {
        console.info("[Audio] recorder started");
        console.info(`[Audio] MediaRecorder MIME type: ${recorder.mimeType}`);
      };
      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;

        console.info(`[Audio] chunk: ${event.data.size} bytes`);

        const connection = deepgramConnectionRef.current;
        if (connection?.socket.readyState === WebSocket.OPEN) {
          connection.sendAudio(event.data);
        }
      };
      recorder.onerror = () => {
        console.error("[Audio Debug] Recording failed", { state: recorder.state });
        deepgramAttemptRef.current += 1;
        deepgramConnectionRef.current?.close();
        deepgramConnectionRef.current = null;
        semanticStreamRef.current?.close();
        semanticStreamRef.current = null;
        humeSessionRef.current?.stop();
        humeSessionRef.current = null;
        setInterimCaptions([]);
        stopMicrophone(stream);
        if (recorder.state !== "inactive") recorder.stop();
        if (mountedRef.current) {
          setErrorMessage("Audio recording failed. Please try again.");
          setIsListening(false);
        }
      };
      recorder.onstop = () => {
        console.info("[Audio] recorder stopped");
        semanticStreamRef.current?.stop();
        semanticStreamRef.current = null;
        humeSessionRef.current?.stop();
        humeSessionRef.current = null;
        const connection = deepgramConnectionRef.current;
        deepgramConnectionRef.current = null;
        connection?.finish();
        stopMicrophone(stream);
        if (!mountedRef.current) return;
        microphoneStreamRef.current = null;
        recorderRef.current = null;
        busyRef.current = false;
        setIsBusy(false);
        setIsListening(false);
      };

      const semanticUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "";
      const semanticPreparation = prepareSemanticStream(stream, semanticUrl, {
        onCue: (cue) => {
          if (!mountedRef.current || deepgramAttemptRef.current !== attempt) return;
          if (cue.category === "emotion") {
            const cueKey = `${cue.label}-${cue.start}-${cue.end}`;
            setEmotionAlerts((current) =>
              [
                ...current.filter(
                  (item) => `${item.label}-${item.start}-${item.end}` !== cueKey,
                ),
                cue,
              ].slice(-MAX_EMOTION_ALERTS),
            );
            const timer = window.setTimeout(() => {
              setEmotionAlerts((current) =>
                current.filter(
                  (item) => `${item.label}-${item.start}-${item.end}` !== cueKey,
                ),
              );
              emotionAlertTimersRef.current =
                emotionAlertTimersRef.current.filter((item) => item !== timer);
            }, EMOTION_ALERT_DURATION_MS);
            emotionAlertTimersRef.current.push(timer);
            return;
          }
          setAudioCues((current) =>
            mergeAudioCue(current, cue).slice(-MAX_SEMANTIC_CUES),
          );
        },
        onWarning: (message) => {
          if (!mountedRef.current || deepgramAttemptRef.current !== attempt) return;
          console.warn(`[Semantic] ${message}`);
        },
      })
        .then((semanticStream) => {
          if (!mountedRef.current || deepgramAttemptRef.current !== attempt) {
            semanticStream.close();
            return null;
          }
          semanticStreamRef.current = semanticStream;
          return semanticStream;
        })
        .catch((error: unknown) => {
          console.warn(
            "[Semantic] live sound labels are unavailable; transcription will continue",
            error,
          );
          return null;
        });
      void startHumeExpressionAnalysis(stream, {
        onStatus: () => {},
        onAlert: (alert) => {
          if (!mountedRef.current || deepgramAttemptRef.current !== attempt) return;
          if (humeAlertTimerRef.current !== null) {
            window.clearTimeout(humeAlertTimerRef.current);
          }
          setHumeAlert(alert);
          humeAlertTimerRef.current = window.setTimeout(() => {
            setHumeAlert(null);
            humeAlertTimerRef.current = null;
          }, HUME_ALERT_DURATION_MS);
        },
        onWarning: (message) => {
          console.warn(`[Hume] unavailable: ${message}`);
        },
      })
        .then((session) => {
          if (!mountedRef.current || deepgramAttemptRef.current !== attempt) {
            session.stop();
            return;
          }
          humeSessionRef.current = session;
        })
        .catch((error: unknown) => {
          console.warn(
            `[Hume] unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
          );
        });
      setIsListening(true);

      const tokenResponse = await fetch("/api/deepgram-token", { method: "POST" });
      const tokenData: unknown = await tokenResponse.json();
      if (!tokenResponse.ok) {
        throw new Error("Could not get a temporary Deepgram token.");
      }
      if (
        typeof tokenData !== "object" ||
        tokenData === null ||
        !("access_token" in tokenData) ||
        typeof tokenData.access_token !== "string" ||
        !tokenData.access_token
      ) {
        throw new Error("The token endpoint did not return a temporary access token.");
      }

      if (!mountedRef.current || deepgramAttemptRef.current !== attempt) return;

      const connection = connectToDeepgram(tokenData.access_token, {
        onOpen: () => {
          if (mountedRef.current && deepgramAttemptRef.current === attempt) {
            void semanticPreparation.then((semanticStream) => {
              if (!mountedRef.current || deepgramAttemptRef.current !== attempt) {
                semanticStream?.close();
                return;
              }
              if (semanticStream) {
                try {
                  const sessionId =
                    typeof globalThis.crypto?.randomUUID === "function"
                      ? globalThis.crypto.randomUUID()
                      : `semantic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                  semanticStream.start(sessionId, {
                    enableVolume: true,
                  });
                } catch (error) {
                  console.warn(
                    "[Semantic] could not start live sound labels; transcription will continue",
                    error,
                  );
                  semanticStream.close();
                  semanticStreamRef.current = null;
                }
              }
              try {
                recorder.start(AUDIO_CHUNK_MS);
              } catch {
                stopAfterDeepgramFailure(attempt, "Could not start audio recording.");
              }
            });
          }
        },
        onError: () => {
          stopAfterDeepgramFailure(attempt, "Could not connect to Deepgram.");
        },
        onClose: (event) => {
          stopAfterDeepgramFailure(
            attempt,
            `Deepgram disconnected unexpectedly (code ${event.code}).`,
          );
        },
        onTranscripts: (transcripts) => {
          if (!mountedRef.current || deepgramAttemptRef.current !== attempt) return;

          if (transcripts[0]?.final) {
            setFinalCaptions((current) => {
              const next = [...current];
              for (const transcript of transcripts) {
                const existingIndex = next.findIndex((item) => item.id === transcript.id);
                if (existingIndex === -1) next.push(transcript);
                else next[existingIndex] = transcript;
              }
              return next.slice(-MAX_FINAL_CAPTIONS);
            });
            setInterimCaptions([]);
          } else {
            setInterimCaptions(transcripts);
          }
        },
      }, { speakerDiarization: true });
      deepgramConnectionRef.current = connection;
    } catch (error) {
      deepgramAttemptRef.current += 1;
      deepgramConnectionRef.current?.close();
      deepgramConnectionRef.current = null;
      semanticStreamRef.current?.close();
      semanticStreamRef.current = null;
      humeSessionRef.current?.stop();
      humeSessionRef.current = null;
      setInterimCaptions([]);
      setEmotionAlerts([]);
      for (const timer of emotionAlertTimersRef.current) window.clearTimeout(timer);
      emotionAlertTimersRef.current = [];
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stopMicrophone(microphoneStreamRef.current);
      microphoneStreamRef.current = null;
      recorderRef.current = null;
      if (!mountedRef.current) return;
      console.error("[Audio Debug] Microphone/recorder startup failed", { name: error instanceof Error ? error.name : "UnknownError" });
      setErrorMessage(
        error instanceof Error ? error.message : "Audio recording failed. Please try again.",
      );
      setIsListening(false);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setIsBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-stretch justify-center sm:items-center sm:px-4 sm:py-8">
      <div className="app-shell">
        <header className="pb-4">
          <BrandHeader />
          <div className="mt-5">
            <ModeSelector
              mode={mode}
              onChange={setMode}
              disabled={isListening || isBusy}
            />
          </div>
          {mode === "nearby" ? (
            <div className="mt-4">
              <StatusIndicator isListening={isListening} errorMessage={errorMessage} />
            </div>
          ) : null}
        </header>

        {mode === "nearby" ? (
          <>
            <EmotionNotification alert={humeAlert} />
            <EmotionAlerts cues={emotionAlerts} />
            <section className="flex-1 rounded-3xl border border-[#dfe3da] bg-[var(--surface-soft)] p-3 sm:p-4">
              <CaptionDisplay
                transcripts={finalCaptions}
                interimTranscripts={interimCaptions}
                audioCues={audioCues}
              />
            </section>

            <div className="pb-1 pt-4">
              <ListeningButton listening={isListening} onToggle={handleToggleListening} disabled={isBusy} />
            </div>
          </>
        ) : (
          <CallLanding />
        )}
      </div>
    </main>
  );
}
