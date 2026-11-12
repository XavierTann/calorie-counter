import webpush from "web-push";
import { deletePushSub, type PushSub } from "./db";

// Web push needs a VAPID key pair (generate once with `npx web-push generate-vapid-keys`).
export function pushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup() {
  if (ready) return;
  // The "subject" identifies the sender to Apple/Google; the app's own URL is enough.
  const host = process.env.VAPID_SUBJECT || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://localhost");
  webpush.setVapidDetails(host, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

export type PushMessage = { title: string; body: string; url: string };

// Sends to every device; removes subscriptions the browser has thrown away. Returns how many were delivered.
export async function sendPush(subs: PushSub[], msg: PushMessage): Promise<number> {
  if (!pushConfigured() || !subs.length) return 0;
  setup();
  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 6 });
        return true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await deletePushSub(s.endpoint);
        else console.warn("push failed", status, e instanceof Error ? e.message : e);
        return false;
      }
    }),
  );
  return results.filter(Boolean).length;
}
