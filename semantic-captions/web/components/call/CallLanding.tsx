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
    <section className="rounded-3xl border border-slate-700 bg-slate-950/80 p-6 text-center">
      <h2 className="text-xl font-semibold text-white">Start an internet call</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Create a private room, then share its link with the person you want to call.
      </p>
      <button
        type="button"
        onClick={createCall}
        className="mt-6 w-full rounded-2xl bg-sky-500 px-5 py-4 text-lg font-semibold text-white transition hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-400/60"
      >
        Create Call
      </button>
    </section>
  );
}
