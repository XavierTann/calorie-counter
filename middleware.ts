import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, sessionToken } from "./lib/auth";

const PUBLIC = ["/login", "/api/login", "/api/energy/sync", "/manifest.webmanifest", "/icon", "/apple-icon"];

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "."))) {
    return NextResponse.next();
  }
  if (req.cookies.get(AUTH_COOKIE)?.value === (await sessionToken())) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
