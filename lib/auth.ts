// Single-user password protection. Works in both edge middleware and Node routes.
export const AUTH_COOKIE = "cc_auth";

export function authEnabled() {
  return !!process.env.APP_PASSWORD;
}

export async function sessionToken(): Promise<string> {
  const secret = process.env.APP_PASSWORD ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("calorie-counter-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Token for the Garmin / Apple Health sync endpoint (falls back to the app password).
export function ingestToken() {
  return process.env.INGEST_TOKEN || process.env.APP_PASSWORD || "";
}
