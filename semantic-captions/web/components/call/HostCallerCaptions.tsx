"use client";

import { useRoomContext } from "@livekit/components-react";
import {
  RemoteAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  RoomEvent,
  Track,
} from "livekit-client";
import { useEffect, useRef, useState } from "react";
import {
  startCallTranscription,
  type CallTranscriptionSession,
} from "../../audio/callTranscription";
import {
  startCallSemanticAnalysis,
  type CallSemanticSession,
} from "../../audio/callSemantic";
import { mergeAudioCue } from "../../captions/mergeCues";
import type { AudioCue, Transcript } from "../../captions/types";
import { CaptionDisplay } from "../CaptionDisplay";

const MAX_FINAL_CAPTIONS = 100;
const MAX_SEMANTIC_CUES = 200;

type CaptionStatus = "waiting" | "starting" | "listening" | "error";

type ActiveTranscription = {
  generation: number;
  participantSid: string;
  trackSid: string;
  controller: AbortController;
  session: CallTranscriptionSession | null;
  semanticSession: CallSemanticSession | null;
};

function hasCallerRole(participant: RemoteParticipant): boolean {
  if (!participant.metadata) return false;

  try {
    const metadata: unknown = JSON.parse(participant.metadata);
    return (
      typeof metadata === "object" &&
      metadata !== null &&
      "role" in metadata &&
      metadata.role === "caller"
    );
  } catch {
    return false;
  }
}

function isCallerMicrophone(
  track: RemoteTrack,
  publication: RemoteTrackPublication,
  participant: RemoteParticipant,
): track is RemoteAudioTrack {
  return (
    hasCallerRole(participant) &&
    track instanceof RemoteAudioTrack &&
    track.kind === Track.Kind.Audio &&
    publication.source === Track.Source.Microphone
  );
}

export function HostCallerCaptions() {
  const room = useRoomContext();
  const [finalCaptions, setFinalCaptions] = useState<Transcript[]>([]);
  const [interimCaption, setInterimCaption] = useState<Transcript | null>(null);
  const [audioCues, setAudioCues] = useState<AudioCue[]>([]);
  const [status, setStatus] = useState<CaptionStatus>("waiting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNumber, setRetryNumber] = useState(0);
  const pipelineGenerationRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let active: ActiveTranscription | null = null;

    const stopActive = (
      nextStatus: CaptionStatus = "waiting",
      updateState = true,
    ) => {
      pipelineGenerationRef.current += 1;
      active?.controller.abort();
      active?.session?.stop();
      active?.semanticSession?.stop();
      active = null;
      if (updateState) {
        setInterimCaption(null);
        setAudioCues([]);
        setStatus(nextStatus);
      }
    };

    const startTrack = async (
      track: RemoteAudioTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (disposed || active?.trackSid === publication.trackSid) return;

      stopActive("starting");
      const trackGeneration = pipelineGenerationRef.current + 1;
      pipelineGenerationRef.current = trackGeneration;
      const controller = new AbortController();
      active = {
        generation: trackGeneration,
        participantSid: participant.sid,
        trackSid: publication.trackSid,
        controller,
        session: null,
        semanticSession: null,
      };
      setErrorMessage(null);

      console.info("[Call Transcription] Caller participant found");
      console.info("[Call Transcription] Caller microphone subscribed");
      console.info("[Call Transcription] Starting Deepgram");

      const startSemanticSidecar = async () => {
        try {
          const semanticSession = await startCallSemanticAnalysis(
            track,
            controller.signal,
            {
              onCue: (cue) => {
                if (disposed || active?.generation !== trackGeneration) return;
                setAudioCues((current) =>
                  mergeAudioCue(current, cue).slice(-MAX_SEMANTIC_CUES),
                );
              },
            },
          );
          if (!semanticSession) return;

          if (disposed || active?.generation !== trackGeneration) {
            semanticSession.stop();
            return;
          }
          active.semanticSession = semanticSession;
        } catch (error) {
          if (!controller.signal.aborted) {
            console.warn("[Call Semantic] unavailable", error);
          }
        }
      };

      try {
        const session = await startCallTranscription(track, controller.signal, {
          onStarted: () => {
            if (!disposed && active?.generation === trackGeneration) {
              setStatus("listening");
              void startSemanticSidecar();
            }
          },
          onTranscript: (transcript) => {
            if (disposed || active?.generation !== trackGeneration) return;

            const callerTranscript = {
              ...transcript,
              id: `call-${trackGeneration}-${transcript.id}`,
            };
            console.info(
              `[Call Transcription] ${transcript.final ? "Final" : "Interim"}: ${transcript.text}`,
            );

            if (callerTranscript.final) {
              setFinalCaptions((current) => {
                const existingIndex = current.findIndex(
                  (caption) => caption.id === callerTranscript.id,
                );
                const next =
                  existingIndex === -1
                    ? [...current, callerTranscript]
                    : current.map((caption, index) =>
                        index === existingIndex ? callerTranscript : caption,
                      );
                return next.slice(-MAX_FINAL_CAPTIONS);
              });
              setInterimCaption(null);
            } else {
              setInterimCaption(callerTranscript);
            }
          },
          onError: (message) => {
            if (disposed || active?.generation !== trackGeneration) return;
            active?.session?.stop();
            active = null;
            setInterimCaption(null);
            setErrorMessage(message);
            setStatus("error");
          },
        });

        if (disposed || active?.generation !== trackGeneration) {
          session.stop();
          return;
        }
        active.session = session;
      } catch (error) {
        if (
          disposed ||
          controller.signal.aborted ||
          active?.generation !== trackGeneration
        ) {
          return;
        }
        active = null;
        setInterimCaption(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Could not start caller captions.",
        );
        setStatus("error");
      }
    };

    const considerTrack = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (isCallerMicrophone(track, publication, participant)) {
        void startTrack(track, publication, participant);
      }
    };

    const scanForCallerTrack = () => {
      for (const participant of room.remoteParticipants.values()) {
        if (!hasCallerRole(participant)) continue;
        const publication = participant.getTrackPublication(Track.Source.Microphone);
        if (publication?.track) {
          considerTrack(publication.track, publication, participant);
          return;
        }
      }
    };

    const handleTrackUnsubscribed = (
      _track: RemoteTrack,
      publication: RemoteTrackPublication,
    ) => {
      if (active?.trackSid !== publication.trackSid) return;
      stopActive();
      queueMicrotask(scanForCallerTrack);
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      if (active?.participantSid !== participant.sid) return;
      stopActive();
      queueMicrotask(scanForCallerTrack);
    };

    room.on(RoomEvent.TrackSubscribed, considerTrack);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.ParticipantMetadataChanged, scanForCallerTrack);
    scanForCallerTrack();

    return () => {
      disposed = true;
      room.off(RoomEvent.TrackSubscribed, considerTrack);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.ParticipantMetadataChanged, scanForCallerTrack);
      stopActive("waiting", false);
    };
  }, [retryNumber, room]);

  return (
    <section className="mt-5 border-t border-[var(--border-soft)] pt-5">
      <p className="flex items-center gap-2 text-sm font-medium text-[#456052]" aria-live="polite">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${status === "listening" ? "bg-[var(--status-active)]" : "bg-[var(--status-idle)]"}`}
        />
        {status === "waiting"
          ? "Waiting for caller..."
          : status === "starting"
            ? "Caller connected. Starting captions..."
            : status === "listening"
              ? "Caller connected. Listening for caller..."
              : "Caller captions are unavailable."}
      </p>

      {status === "error" ? (
        <div className="mt-3">
          <p role="alert" className="error-panel">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => setRetryNumber((current) => current + 1)}
            className="button-secondary mt-3"
          >
            Retry Captions
          </button>
        </div>
      ) : null}

      {status === "listening" || finalCaptions.length > 0 || interimCaption ? (
        <div className="mt-4 rounded-3xl border border-[#dfe3da] bg-[var(--surface-soft)] p-3">
          <CaptionDisplay
            transcripts={finalCaptions}
            interimTranscript={interimCaption}
            audioCues={audioCues}
            speakerLabel="Caller"
            emptyMessage="Listening for caller..."
          />
        </div>
      ) : null}
    </section>
  );
}
