import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { ROOM_ID_PATTERN, type CallRole } from "../../../lib/call";

export const runtime = "nodejs";

const TOKEN_TTL = "15m";
const VALID_ROLES = new Set<CallRole>(["host", "caller"]);

function validServerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "wss:" || url.protocol === "ws:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const roomId =
    "roomId" in body && typeof body.roomId === "string" ? body.roomId : "";
  const role = "role" in body && typeof body.role === "string" ? body.role : "";

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
  }
  if (!VALID_ROLES.has(role as CallRole)) {
    return NextResponse.json({ error: "Invalid call role" }, { status: 400 });
  }

  const serverUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

  if (!serverUrl || !validServerUrl(serverUrl) || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit is not configured" },
      { status: 500 },
    );
  }

  try {
    const participantToken = new AccessToken(apiKey, apiSecret, {
      identity: `participant-${randomUUID()}`,
      metadata: JSON.stringify({ role }),
      ttl: TOKEN_TTL,
    });

    participantToken.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: [TrackSource.MICROPHONE],
    });

    return NextResponse.json(
      {
        server_url: serverUrl,
        participant_token: await participantToken.toJwt(),
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not create a LiveKit participant token" },
      { status: 500 },
    );
  }
}
