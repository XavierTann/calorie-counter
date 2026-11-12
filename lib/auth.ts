// Session cookies signed with HMAC. Uses Web Crypto so it works in both edge middleware and Node routes.
export const AUTH_COOKIE = "ml_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.APP_PASSWORD;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return "dev-only-secret";
}

async function sign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeSession(userId: number): Promise<string> {
  return `${userId}.${await sign(`makan-log-session:${userId}`)}`;
}

// Returns the user id from a session cookie, or null if it's missing or forged.
export async function verifySession(value: string | undefined): Promise<number | null> {
  const m = value?.match(/^(\d+)\.([0-9a-f]{64})$/);
  if (!m) return null;
  const expected = await sign(`makan-log-session:${m[1]}`);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0 ? Number(m[1]) : null;
}
