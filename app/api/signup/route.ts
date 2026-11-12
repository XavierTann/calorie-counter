import { NextResponse } from "next/server";
import { createUser, getUserByName } from "@/lib/db";
import { hashPassword, newSyncToken, sameText } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";

const inviteCode = () => process.env.INVITE_CODE?.trim() ?? "";

// Lets the sign-up page know whether to ask for an invite code.
export async function GET() {
  return NextResponse.json({ inviteRequired: !!inviteCode() });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { username?: string; password?: string; invite?: string };
  const username = String(b.username ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");

  const code = inviteCode();
  if (code && !sameText(String(b.invite ?? "").trim().toLowerCase(), code.toLowerCase())) {
    return NextResponse.json({ error: "That invite code isn't right" }, { status: 403 });
  }
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "Username: 3–32 letters, numbers, dots, dashes or underscores" }, { status: 400 });
  }
  if (password.length < 8) return NextResponse.json({ error: "Password needs at least 8 characters" }, { status: 400 });
  if (await getUserByName(username)) return NextResponse.json({ error: "That username is taken" }, { status: 409 });

  let user;
  try {
    user = await createUser(username, await hashPassword(password), newSyncToken());
  } catch (e) {
    if (e instanceof Error && /unique/i.test(e.message)) return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    throw e;
  }
  const res = NextResponse.json({ ok: true });
  await setSessionCookie(res, user.id);
  return res;
}
