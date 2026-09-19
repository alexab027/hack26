import { NextResponse } from "next/server";

/**
 * Server-only endpoint for issuing a short-lived Deepgram browser credential.
 * A permanent DEEPGRAM_API_KEY must never be returned to or bundled in the browser.
 */
export async function POST() {
  // TODO: Use the server-side API key to request a scoped, expiring Deepgram token.
  return NextResponse.json(
    { error: "Deepgram token issuance is not implemented." },
    { status: 501 },
  );
}

