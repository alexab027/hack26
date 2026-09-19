"use client";

import { useEffect, useRef, useState } from "react";
import { CaptionDisplay } from "../components/CaptionDisplay";
import { ListeningButton } from "../components/ListeningButton";
import { StatusIndicator } from "../components/StatusIndicator";
import type { Transcript } from "../captions/types";
import { startMicrophoneCapture, stopMicrophone } from "../audio/microphone";

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

  useEffect(() => {
    return () => {
      stopMicrophone(microphoneStreamRef.current);
    };
  }, []);

  const handleToggleListening = async () => {
    if (isListening) {
      stopMicrophone(microphoneStreamRef.current);
      microphoneStreamRef.current = null;
      setIsListening(false);
      setErrorMessage(null);
      return;
    }

    try {
      const stream = await startMicrophoneCapture();
      microphoneStreamRef.current = stream;
      setIsListening(true);
      setErrorMessage(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Microphone access failed. Please allow permission and try again.";

      setErrorMessage(message);
      setIsListening(false);
      microphoneStreamRef.current = null;
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
          <ListeningButton
            listening={isListening}
            onToggle={handleToggleListening}
          />
        </div>
      </div>
    </main>
  );
}
