import { NextResponse } from "next/server";
import { getUserByName } from "@/lib/db";
import { checkPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const user = username ? await getUserByName(username.trim().toLowerCase()) : null;
  if (!user || !password || !(await checkPassword(password, user.passHash))) {
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  await setSessionCookie(res, user.id);
  return res;
}
