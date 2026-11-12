import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_MAX_AGE, makeSession, verifySession } from "./auth";

// The logged-in user's id for API routes, or null.
export async function currentUserId(): Promise<number | null> {
  return verifySession((await cookies()).get(AUTH_COOKIE)?.value);
}

export const unauthorized = () => NextResponse.json({ error: "Not logged in" }, { status: 401 });

export async function setSessionCookie(res: NextResponse, userId: number) {
  res.cookies.set(AUTH_COOKIE, await makeSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
