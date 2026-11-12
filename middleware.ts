import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySession } from "./lib/auth";

const PUBLIC = ["/login", "/signup", "/api/login", "/api/signup", "/api/energy/sync", "/api/cron", "/sw.js", "/manifest.webmanifest", "/icon", "/apple-icon"];

// Redirects logged-out visitors to /login. API routes also check the session themselves.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "."))) {
    return NextResponse.next();
  }
  if (await verifySession(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
