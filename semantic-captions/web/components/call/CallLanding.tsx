"use client";

import { useRouter } from "next/navigation";
import { generateRoomId, hostSessionKey } from "../../lib/call";

export function CallLanding() {
  const router = useRouter();

  const createCall = () => {
    const roomId = generateRoomId();
    sessionStorage.setItem(hostSessionKey(roomId), "true");
    router.push(`/call/${roomId}`);
  };

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 py-8 text-center sm:px-7">
      <span aria-hidden="true" className="text-3xl text-[var(--sage)]">[ ]</span>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--forest)]">Start a call</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
        Invite someone to talk with you through Subtext.
      </p>
      <button
        type="button"
        onClick={createCall}
        className="button-primary mt-7"
      >
        Create Call
      </button>
    </section>
  );
}
