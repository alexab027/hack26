"use client";

import { useEffect, useRef, useState } from "react";
import { CaptionDisplay } from "../components/CaptionDisplay";
import { ListeningButton } from "../components/ListeningButton";
import { StatusIndicator } from "../components/StatusIndicator";
import type { Transcript } from "../captions/types";
import { startMicrophone, stopMicrophone } from "../audio/microphone";

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
  // Temporary audio checkpoint: keep whole-file recording out of the streaming layer.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [recording, setRecording] = useState<{ url: string; size: number; mimeType: string } | null>(null);

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

  const handleToggleListening = async () => {
    if (busyRef.current) return;
    if (isListening) {
      busyRef.current = true;
      setIsBusy(true);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
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
      // Let Chrome/Safari choose their native format instead of forcing WebM.
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      let recordingFailed = false;
      recorder.onstart = () => {
        console.info("[Audio Debug] Recording started", { state: recorder.state, mimeType: recorder.mimeType });
      };
      recorder.ondataavailable = (event) => {
        console.info("[Audio Debug] dataavailable", { size: event.data.size, mimeType: event.data.type, state: recorder.state });
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recordingFailed = true;
        console.error("[Audio Debug] Recording failed", { state: recorder.state });
        stopMicrophone(stream);
        if (recorder.state !== "inactive") recorder.stop();
        if (mountedRef.current) {
          setErrorMessage("Audio recording failed. Please try again.");
          setIsListening(false);
        }
      };
      recorder.onstop = () => {
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
      recorder.start(1000);
      console.info("[Audio Debug] MediaRecorder", { state: recorder.state, mimeType: recorder.mimeType });
      setIsListening(true);
    } catch (error) {
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
