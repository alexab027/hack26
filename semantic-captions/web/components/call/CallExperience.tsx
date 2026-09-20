"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandHeader } from "../BrandHeader";
import { ModeSelector } from "../ModeSelector";
import { HostCallerCaptions } from "./HostCallerCaptions";
import { hostSessionKey, type CallRole } from "../../lib/call";

type CallState = "lobby" | "connecting" | "connected" | "disconnected" | "error";

type ConnectionDetails = {
  serverUrl: string;
  participantToken: string;
};

type TokenResponse = {
  server_url?: unknown;
  participant_token?: unknown;
};

type NgrokUrlResponse = {
  public_url?: unknown;
};

function ConnectedCall({
  role,
  roomId,
  participantToken,
  shareUrl,
  onEnd,
}: {
  role: CallRole;
  roomId: string;
  participantToken: string;
  shareUrl: string;
  onEnd: () => void;
}) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [muteBusy, setMuteBusy] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [endBusy, setEndBusy] = useState(false);

  const toggleMute = async () => {
    if (muteBusy) return;
    setMuteBusy(true);
    setControlError(null);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      setControlError("Could not change the microphone setting.");
    } finally {
      setMuteBusy(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setControlError("Could not copy the link. Select and copy it manually.");
    }
  };

  const endCall = async () => {
    if (endBusy) return;
    setEndBusy(true);
    setControlError(null);

    try {
      const response = await fetch("/api/livekit-end-call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${participantToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId }),
      });

      if (!response.ok) {
        throw new Error("Could not end the call for everyone.");
      }

      await room.disconnect(true);
      onEnd();
    } catch (error) {
      setControlError(
        error instanceof Error ? error.message : "Could not end the call for everyone.",
      );
      setEndBusy(false);
    }
  };

  const shareControls = (
    <div>
      <label htmlFor="share-call-url" className="text-sm font-semibold text-[var(--forest)]">
        Share this link
      </label>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          id="share-call-url"
          readOnly
          value={shareUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-secondary)] focus:border-[var(--sage)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-medium)]"
        />
        <button
          type="button"
          onClick={copyLink}
          disabled={!shareUrl}
          className="button-secondary whitespace-nowrap"
        >
          {copied ? "Copied" : shareUrl ? "Copy" : "Preparing"}
        </button>
      </div>
    </div>
  );

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#456052]">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-active)]" />
        Connected
      </div>

      {role === "host" ? (
        <div className="mt-4">
          <p className="text-lg font-semibold text-[var(--forest)]">
            {remoteParticipants.length > 0 ? "Caller connected" : "Waiting for caller"}
          </p>
          {remoteParticipants.length > 0 ? (
            <details className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-[var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
                Share link
              </summary>
              <div className="pb-3">{shareControls}</div>
            </details>
          ) : (
            <div className="mt-4">{shareControls}</div>
          )}
          <HostCallerCaptions />
        </div>
      ) : (
        <p className="mt-5 text-2xl font-semibold text-[var(--forest)]">In call</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={toggleMute}
          disabled={muteBusy}
          className="button-secondary"
        >
          {muteBusy ? "Updating..." : isMicrophoneEnabled ? "Mute" : "Unmute"}
        </button>
        <button
          type="button"
          onClick={endCall}
          disabled={endBusy}
          className="min-h-11 rounded-xl bg-[var(--danger)] px-4 py-2.5 font-semibold text-white transition hover:bg-[var(--danger-dark)] focus:outline-none focus:ring-4 focus:ring-[#d9aaaa]/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {endBusy ? "Ending..." : "End Call"}
        </button>
      </div>

      {controlError ? (
        <p role="alert" className="error-panel mt-4">
          {controlError}
        </p>
      ) : null}

      <RoomAudioRenderer />
      <StartAudio className="button-secondary mt-4 w-full" label="Tap to allow call audio" />
    </section>
  );
}

export function CallExperience({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [role, setRole] = useState<CallRole | null>(null);
  const [callState, setCallState] = useState<CallState>("lobby");
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoJoinStartedRef = useRef(false);
  const requestNumberRef = useRef(0);

  useEffect(() => {
    const isHost = sessionStorage.getItem(hostSessionKey(roomId)) === "true";
    setRole(isHost ? "host" : "caller");
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    const fallbackUrl = `${window.location.origin}/call/${roomId}`;
    setShareUrl("");

    const loadShareUrl = async () => {
      try {
        const response = await fetch("/api/ngrok-url", { cache: "no-store" });
        const body = (await response.json()) as NgrokUrlResponse;
        if (!response.ok || typeof body.public_url !== "string") {
          throw new Error("No public ngrok URL is available");
        }

        const publicUrl = new URL(body.public_url);
        if (publicUrl.protocol !== "https:") {
          throw new Error("The public ngrok URL is not HTTPS");
        }

        if (!cancelled) {
          setShareUrl(`${publicUrl.origin}/call/${roomId}`);
        }
      } catch {
        if (!cancelled) setShareUrl(fallbackUrl);
      }
    };

    void loadShareUrl();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const joinCall = useCallback(
    async (participantRole: CallRole) => {
      const requestNumber = requestNumberRef.current + 1;
      requestNumberRef.current = requestNumber;
      setCallState("connecting");
      setErrorMessage(null);
      setDetails(null);

      try {
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, role: participantRole }),
        });
        const body = (await response.json()) as TokenResponse;

        if (requestNumberRef.current !== requestNumber) return;

        if (!response.ok) throw new Error("Could not prepare the call.");
        if (
          typeof body.server_url !== "string" ||
          typeof body.participant_token !== "string"
        ) {
          throw new Error("The call server returned an invalid response.");
        }

        setDetails({
          serverUrl: body.server_url,
          participantToken: body.participant_token,
        });
      } catch (error) {
        if (requestNumberRef.current !== requestNumber) return;
        setCallState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Could not prepare the call.",
        );
      }
    },
    [roomId],
  );

  useEffect(() => {
    if (role !== "host" || autoJoinStartedRef.current) return;
    autoJoinStartedRef.current = true;
    void joinCall("host");
  }, [joinCall, role]);

  const leaveCall = () => router.push("/");

  const handleDisconnected = (reason?: DisconnectReason) => {
    setDetails(null);
    setCallState("disconnected");
    if (reason === DisconnectReason.ROOM_DELETED) {
      setErrorMessage("This call was ended by a participant.");
    }
  };

  const handleConnectionError = () => {
    setDetails(null);
    setCallState("error");
    setErrorMessage("Could not connect. Check microphone permission and try again.");
  };

  if (!role) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-6 text-[var(--text-secondary)]">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--sage)]" />
          Preparing call...
        </span>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-stretch justify-center sm:items-center sm:px-4 sm:py-8">
      <div className="app-shell">
        <header className="pb-5">
          <BrandHeader />
          {role === "host" ? (
            <div className="mt-5">
              <ModeSelector
                mode="call"
                disabled={callState === "connecting" || callState === "connected"}
                onChange={(mode) => {
                  if (mode === "nearby") router.push("/");
                }}
              />
            </div>
          ) : null}
        </header>

        {details ? (
          <LiveKitRoom
            token={details.participantToken}
            serverUrl={details.serverUrl}
            connect
            audio
            video={false}
            onConnected={() => setCallState("connected")}
            onDisconnected={handleDisconnected}
            onError={handleConnectionError}
            onMediaDeviceFailure={handleConnectionError}
          >
            {callState === "connected" ? (
              <ConnectedCall
                role={role}
                roomId={roomId}
                participantToken={details.participantToken}
                shareUrl={shareUrl}
                onEnd={leaveCall}
              />
            ) : (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] p-7 text-center">
                <p className="flex items-center justify-center gap-2 font-semibold text-[var(--forest)]">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--sage)]" />
                  Connecting...
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Allow microphone access when prompted.</p>
              </section>
            )}
          </LiveKitRoom>
        ) : (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 py-8 text-center sm:px-7">
            {callState === "disconnected" ? (
              <>
                <h2 className="text-2xl font-semibold text-[var(--forest)]">Call ended</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {errorMessage || "The call is no longer active."}
                </p>
              </>
            ) : role === "caller" ? (
              <>
                <span aria-hidden="true" className="text-3xl text-[var(--sage)]">[ ]</span>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--forest)]">You&apos;ve been invited to a call.</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
                  Subtext provides enhanced captions to the person who invited you. Your microphone is requested only after you join.
                </p>
              </>
            ) : (
              <h2 className="text-2xl font-semibold text-[var(--forest)]">
                Starting your call
              </h2>
            )}

            {callState === "disconnected" ? (
              <button
                type="button"
                onClick={leaveCall}
                className="button-secondary mt-6 w-full text-base"
              >
                Return Home
              </button>
            ) : callState === "connecting" ? (
              <p className="mt-5 flex items-center justify-center gap-2 text-[var(--text-secondary)]">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--sage)]" />
                Preparing call...
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void joinCall(role)}
                className="button-primary mt-7"
              >
                {role === "caller" ? "Join Call" : "Start Again"}
              </button>
            )}

            {errorMessage && callState !== "disconnected" ? (
              <p role="alert" className="error-panel mt-4">
                {errorMessage}
              </p>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
