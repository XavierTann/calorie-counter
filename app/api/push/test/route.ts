import { NextResponse } from "next/server";
import { pushSubsForUser } from "@/lib/db";
import { sendPush } from "@/lib/push";
import { currentUserId, unauthorized } from "@/lib/session";

// Sends a test reminder to all of this user's devices.
export async function POST() {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const sent = await sendPush(await pushSubsForUser(uid), {
    title: "Makan Log",
    body: "Test reminder: this is what you'll see at 9am ⚖️",
    url: "/weight",
  });
  return NextResponse.json({ sent });
}
