export const ROOM_ID_PATTERN = /^sc-[a-z0-9]{32}$/;

export type CallRole = "host" | "caller";

export function generateRoomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `sc-${randomPart}`;
}

export function hostSessionKey(roomId: string): string {
  return `semantic-captions-host:${roomId}`;
}
