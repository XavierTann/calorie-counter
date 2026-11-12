import { NextResponse } from "next/server";
import { getUserById, setSyncToken } from "@/lib/db";
import { newSyncToken } from "@/lib/password";
import { currentUserId, unauthorized } from "@/lib/session";

export async function GET() {
  const uid = await currentUserId();
  const user = uid ? await getUserById(uid) : null;
  if (!user) return unauthorized();
  return NextResponse.json({ username: user.username, syncToken: user.syncToken });
}

// Makes a new Apple Health sync token (the old one stops working).
export async function POST() {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const syncToken = newSyncToken();
  await setSyncToken(uid, syncToken);
  return NextResponse.json({ syncToken });
}
