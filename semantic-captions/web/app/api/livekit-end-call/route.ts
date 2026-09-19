import { NextResponse } from "next/server";
import { RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { ROOM_ID_PATTERN } from "../../../lib/call";

export const runtime = "nodejs";

function roomServiceUrl(liveKitUrl: string): string | null {
  try {
    const url = new URL(liveKitUrl);
    if (url.protocol === "wss:") url.protocol = "https:";
    else if (url.protocol === "ws:") url.protocol = "http:";
    else return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const participantToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!participantToken) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const roomId =
    typeof body === "object" &&
    body !== null &&
    "roomId" in body &&
    typeof body.roomId === "string"
      ? body.roomId
      : "";

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
  }

  const liveKitUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const serviceUrl = liveKitUrl ? roomServiceUrl(liveKitUrl) : null;

  if (!serviceUrl || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit is not configured" },
      { status: 500 },
    );
  }

  try {
    const claims = await new TokenVerifier(apiKey, apiSecret).verify(participantToken);
    if (
      claims.video?.roomJoin !== true ||
      claims.video.room !== roomId ||
      typeof claims.sub !== "string" ||
      !claims.sub
    ) {
      return NextResponse.json(
        { error: "Not authorized for this room" },
        { status: 403 },
      );
    }

    const rooms = new RoomServiceClient(serviceUrl, apiKey, apiSecret);
    await rooms.deleteRoom(roomId);
    return NextResponse.json({ ended: true });
  } catch {
    return NextResponse.json(
      { error: "Could not end the LiveKit room" },
      { status: 502 },
    );
  }
}
