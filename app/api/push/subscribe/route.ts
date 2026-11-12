import { NextResponse } from "next/server";
import { deletePushSub, pushSubsForUser, savePushSub } from "@/lib/db";
import { pushConfigured } from "@/lib/push";
import { currentUserId, unauthorized } from "@/lib/session";

// Public key for the browser, and whether this device is already subscribed (?endpoint=...).
export async function GET(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const endpoint = new URL(req.url).searchParams.get("endpoint");
  const subs = await pushSubsForUser(uid);
  return NextResponse.json({
    configured: pushConfigured(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    subscribed: !!endpoint && subs.some((s) => s.endpoint === endpoint),
    devices: subs.length,
  });
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!b.endpoint?.startsWith("https://") || !b.keys?.p256dh || !b.keys?.auth) {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  await savePushSub(uid, { endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await deletePushSub(endpoint, uid);
  return NextResponse.json({ ok: true });
}
