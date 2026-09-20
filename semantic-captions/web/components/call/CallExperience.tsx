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

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
        Connected
      </div>

      {role === "host" ? (
        <div className="mt-5">
          <label htmlFor="share-call-url" className="text-sm font-medium text-slate-200">
            Share this call
          </label>
          <input
            id="share-call-url"
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-sm text-slate-200 focus:border-sky-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={copyLink}
            disabled={!shareUrl}
            className="mt-3 rounded-xl border border-sky-400/70 px-4 py-2 text-sm font-semibold text-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:cursor-wait disabled:opacity-50"
          >
            {copied ? "Link Copied" : shareUrl ? "Copy Link" : "Preparing Link..."}
          </button>
          <p className="mt-5 text-sm text-slate-300">
            {remoteParticipants.length > 0 ? "Caller connected" : "Waiting for caller..."}
          </p>
          <HostCallerCaptions />
        </div>
      ) : (
        <p className="mt-5 text-lg font-semibold text-white">In Call</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={toggleMute}
          disabled={muteBusy}
          className="rounded-xl bg-slate-700 px-4 py-3 font-semibold text-white hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50"
        >
          {muteBusy ? "Updating..." : isMicrophoneEnabled ? "Mute" : "Unmute"}
        </button>
        <button
          type="button"
          onClick={endCall}
          disabled={endBusy}
          className="rounded-xl bg-rose-500 px-4 py-3 font-semibold text-white hover:bg-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {endBusy ? "Ending..." : "End Call"}
        </button>
      </div>

      {controlError ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {controlError}
        </p>
      ) : null}

      <RoomAudioRenderer />
      <StartAudio label="Tap to allow call audio" />
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
      <main className="flex min-h-screen items-center justify-center px-4 py-6 text-slate-300">
        Preparing call...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6">
      <div className="flex w-full max-w-md flex-col rounded-[2rem] border border-slate-700 bg-slate-900/90 p-4 shadow-2xl shadow-slate-950/40">
        <header className="px-2 pb-4 pt-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Semantic Captions</h1>
          <div className="mt-4">
            <ModeSelector
              mode="call"
              disabled={callState === "connecting" || callState === "connected"}
              onChange={(mode) => {
                if (mode === "nearby") router.push("/");
              }}
            />
          </div>
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
              <section className="rounded-3xl border border-slate-700 bg-slate-950/80 p-6 text-center">
                <p className="text-sky-300">Connecting...</p>
                <p className="mt-2 text-sm text-slate-400">Allow microphone access when prompted.</p>
              </section>
            )}
          </LiveKitRoom>
        ) : (
          <section className="rounded-3xl border border-slate-700 bg-slate-950/80 p-6 text-center">
            {callState === "disconnected" ? (
              <>
                <h2 className="text-xl font-semibold text-white">Call ended</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {errorMessage || "The call is no longer active."}
                </p>
              </>
            ) : role === "caller" ? (
              <>
                <h2 className="text-xl font-semibold text-white">You&apos;ve been invited to a call.</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Your microphone is requested only after you join.
                </p>
              </>
            ) : (
              <h2 className="text-xl font-semibold text-white">
                Starting your call
              </h2>
            )}

            {callState === "disconnected" ? (
              <button
                type="button"
                onClick={leaveCall}
                className="mt-6 w-full rounded-2xl bg-slate-700 px-5 py-4 text-lg font-semibold text-white hover:bg-slate-600 focus:outline-none focus:ring-4 focus:ring-sky-400/60"
              >
                Return Home
              </button>
            ) : callState === "connecting" ? (
              <p className="mt-5 text-sky-300">Preparing call...</p>
            ) : (
              <button
                type="button"
                onClick={() => void joinCall(role)}
                className="mt-6 w-full rounded-2xl bg-sky-500 px-5 py-4 text-lg font-semibold text-white hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-400/60"
              >
                {role === "caller" ? "Join Call" : "Start Again"}
              </button>
            )}

            {errorMessage && callState !== "disconnected" ? (
              <p role="alert" className="mt-4 text-sm text-rose-300">
                {errorMessage}
              </p>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
