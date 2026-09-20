import { NextResponse } from "next/server";

export const runtime = "nodejs";

const NGROK_TUNNELS_URL = "http://127.0.0.1:4040/api/tunnels";
const FRONTEND_PORT = "3000";

type NgrokTunnel = {
  public_url?: unknown;
  config?: {
    addr?: unknown;
  };
};

function asHttpsOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function forwardsToFrontend(tunnel: NgrokTunnel): boolean {
  const address = tunnel.config?.addr;
  if (typeof address !== "string") return false;

  try {
    const url = new URL(address);
    return url.port === FRONTEND_PORT;
  } catch {
    return address.endsWith(`:${FRONTEND_PORT}`);
  }
}

export async function GET() {
  try {
    const response = await fetch(NGROK_TUNNELS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error("Could not query the local ngrok agent");

    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("tunnels" in body) ||
      !Array.isArray(body.tunnels)
    ) {
      throw new Error("The local ngrok agent returned an invalid response");
    }

    const tunnels = body.tunnels as NgrokTunnel[];
    const frontendTunnel =
      tunnels.find(
        (tunnel) =>
          forwardsToFrontend(tunnel) && asHttpsOrigin(tunnel.public_url) !== null,
      ) ?? tunnels.find((tunnel) => asHttpsOrigin(tunnel.public_url) !== null);

    return NextResponse.json({
      public_url: frontendTunnel
        ? asHttpsOrigin(frontendTunnel.public_url)
        : null,
    });
  } catch {
    return NextResponse.json({ public_url: null });
  }
}
