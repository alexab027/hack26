"use client";

import { useEffect, useRef, useState } from "react";
import { CaptionDisplay } from "../components/CaptionDisplay";
import { ListeningButton } from "../components/ListeningButton";
import { StatusIndicator } from "../components/StatusIndicator";
import type { Transcript } from "../captions/types";
import {
  getSupportedRecordingMimeType,
  startMicrophone,
  stopMicrophone,
} from "../audio/microphone";
import { connectToDeepgram, type DeepgramConnection } from "../audio/deepgram";

type DeepgramStatus = "disconnected" | "connecting" | "connected";
const AUDIO_CHUNK_MS = 250;

const mockTranscripts: Transcript[] = [
  {
    id: "1",
    text: "Hey, are you coming downstairs?",
    speaker: 1,
    start: 0,
    end: 3,
    confidence: 0.97,
    final: true,
  },
  {
    id: "2",
    text: "Yeah, give me a second.",
    speaker: 2,
    start: 3,
    end: 6,
    confidence: 0.95,
    final: true,
  },
];

export default function HomePage() {
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  // One recorder supplies both live Deepgram chunks and temporary debug playback.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const deepgramConnectionRef = useRef<DeepgramConnection | null>(null);
  const deepgramAttemptRef = useRef(0);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [recording, setRecording] = useState<{ url: string; size: number; mimeType: string } | null>(null);
  const [deepgramStatus, setDeepgramStatus] = useState<DeepgramStatus>("disconnected");

  const clearRecording = () => {
    audioRef.current?.pause();
    audioRef.current?.removeAttribute("src");
    audioRef.current?.load();
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      deepgramAttemptRef.current += 1;
      deepgramConnectionRef.current?.close();
      deepgramConnectionRef.current = null;
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
      clearRecording();
    };
  }, []);

  const stopAfterDeepgramFailure = (attempt: number, message: string) => {
    if (!mountedRef.current || deepgramAttemptRef.current !== attempt) return;

    deepgramAttemptRef.current += 1;
    const connection = deepgramConnectionRef.current;
    deepgramConnectionRef.current = null;
    connection?.close();
    setDeepgramStatus("disconnected");
    setErrorMessage(message);

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
      setDeepgramStatus("disconnected");
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        const connection = deepgramConnectionRef.current;
        deepgramConnectionRef.current = null;
        connection?.finish();
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
    clearRecording();
    setRecording(null);
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
      const chunks: Blob[] = [];
      let recordingFailed = false;
      recorder.onstart = () => {
        console.info("[Audio] recorder started");
        console.info(`[Audio] MediaRecorder MIME type: ${recorder.mimeType}`);
      };
      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;

        console.info(`[Audio] chunk: ${event.data.size} bytes`);
        chunks.push(event.data);

        const connection = deepgramConnectionRef.current;
        if (connection?.socket.readyState === WebSocket.OPEN) {
          connection.sendAudio(event.data);
        }
      };
      recorder.onerror = () => {
        recordingFailed = true;
        console.error("[Audio Debug] Recording failed", { state: recorder.state });
        deepgramAttemptRef.current += 1;
        deepgramConnectionRef.current?.close();
        deepgramConnectionRef.current = null;
        setDeepgramStatus("disconnected");
        stopMicrophone(stream);
        if (recorder.state !== "inactive") recorder.stop();
        if (mountedRef.current) {
          setErrorMessage("Audio recording failed. Please try again.");
          setIsListening(false);
        }
      };
      recorder.onstop = () => {
        console.info("[Audio] recorder stopped");
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
        const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || "" });
        chunks.length = 0;
        console.info("[Audio Debug] Recording stopped", { state: recorder.state, size: blob.size, mimeType: blob.type });
        if (recordingFailed) return;
        if (blob.size === 0) {
          console.error("[Audio Debug] Final Blob is 0 bytes; no usable audio captured.");
          setErrorMessage("Recording is empty (0 bytes). Try recording again and speak for a few seconds.");
          return;
        }
        const url = URL.createObjectURL(blob);
        recordingUrlRef.current = url;
        setRecording({ url, size: blob.size, mimeType: blob.type });
      };
      setIsListening(true);

      const attempt = deepgramAttemptRef.current + 1;
      deepgramAttemptRef.current = attempt;
      setDeepgramStatus("connecting");

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
            setDeepgramStatus("connected");
            try {
              recorder.start(AUDIO_CHUNK_MS);
            } catch {
              stopAfterDeepgramFailure(attempt, "Could not start audio recording.");
            }
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
      });
      deepgramConnectionRef.current = connection;
    } catch (error) {
      deepgramAttemptRef.current += 1;
      deepgramConnectionRef.current?.close();
      deepgramConnectionRef.current = null;
      setDeepgramStatus("disconnected");
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

  const playRecording = async () => {
    const audio = audioRef.current;
    if (!audio || !recording) return;
    setErrorMessage(null);
    try {
      audio.currentTime = 0;
      await audio.play();
    } catch {
      if (mountedRef.current) setErrorMessage("Could not play the recording. Try recording again.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6">
      <div className="flex w-full max-w-md flex-col rounded-[2rem] border border-slate-700 bg-slate-900/90 p-4 shadow-2xl shadow-slate-950/40">
        <header className="px-2 pb-3 pt-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Semantic Captions</h1>
          <div className="mt-3">
            <StatusIndicator isListening={isListening} errorMessage={errorMessage} />
            <p aria-live="polite" className="mt-2 text-sm text-slate-300">
              Deepgram: {deepgramStatus === "connecting" ? "Connecting..." : deepgramStatus === "connected" ? "Connected" : "Disconnected"}
            </p>
          </div>
        </header>

        <section className="flex-1 rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
          <CaptionDisplay transcripts={mockTranscripts} />
        </section>

        <div className="px-2 pb-2 pt-5">
          <ListeningButton listening={isListening} onToggle={handleToggleListening} disabled={isBusy} />
          <section aria-label="Audio Debug" className="mt-4 text-sm text-slate-300">
            <p className="mb-2">Audio Debug (temporary)</p>
            <button
              type="button"
              disabled={!recording || isListening || isBusy}
              onClick={playRecording}
              className="rounded-lg border border-slate-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-40"
            >
              Play Recording
            </button>
            <p aria-live="polite" className="mt-2">
              {isBusy ? "Preparing audio…" : recording ? `Recording captured: ${recording.size.toLocaleString()} bytes (${recording.mimeType || "browser default"})` : "Record a few seconds, then stop to play it back."}
            </p>
            <audio ref={audioRef} src={recording?.url} onError={() => setErrorMessage("The browser could not decode this recording. Try recording again.")} />
          </section>
        </div>
      </div>
    </main>
  );
}
