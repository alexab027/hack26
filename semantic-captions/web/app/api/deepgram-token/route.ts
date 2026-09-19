import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "Deepgram API key is not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Deepgram temporary token request failed" },
        { status: response.status },
      );
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("access_token" in data) ||
      typeof data.access_token !== "string"
    ) {
      return NextResponse.json(
        { error: "Deepgram returned an invalid token response" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      access_token: data.access_token,
      ...("expires_in" in data && typeof data.expires_in === "number"
        ? { expires_in: data.expires_in }
        : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to contact Deepgram" },
      { status: 502 },
    );
  }
}
