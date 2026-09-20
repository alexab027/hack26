import { fetchAccessToken } from "hume";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.HUME_API_KEY?.trim();
  const secretKey = process.env.HUME_SECRET_KEY?.trim();
  const configId = process.env.HUME_CONFIG_ID?.trim();

  if (!apiKey || !secretKey) {
    return NextResponse.json(
      { error: "Hume API credentials are not configured" },
      { status: 500 },
    );
  }

  try {
    const accessToken = await fetchAccessToken({ apiKey, secretKey });
    return NextResponse.json({
      access_token: accessToken,
      ...(configId ? { config_id: configId } : {}),
    });
  } catch (error) {
    console.error(
      "[Hume Token] temporary token request failed",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Hume temporary token request failed" },
      { status: 502 },
    );
  }
}
