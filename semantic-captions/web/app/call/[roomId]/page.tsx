import { notFound } from "next/navigation";
import { CallExperience } from "../../../components/call/CallExperience";
import { ROOM_ID_PATTERN } from "../../../lib/call";

type CallPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function CallPage({ params }: CallPageProps) {
  const { roomId } = await params;

  if (!ROOM_ID_PATTERN.test(roomId)) notFound();

  return <CallExperience roomId={roomId} />;
}
