"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";

const GENERIC = ["Your daily session is ready.", "Ten minutes for your ears.", "Twelve notes are waiting."];

/** Sends one device its daily reminder, then books tomorrow's. */
export const fire = internalAction({
  args: { id: v.id("devices") },
  handler: async (ctx, { id }) => {
    const device = await ctx.runQuery(internal.devices.get, { id });
    if (!device) return null;
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
    let gone = false;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) console.warn("VAPID keys are not set; skipping push");
    else {
      webpush.setVapidDetails(VAPID_SUBJECT ?? "mailto:noreply@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      const body = device.body ?? GENERIC[Math.floor(Date.now() / 86_400_000) % GENERIC.length];
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          JSON.stringify({ title: "Chroma", body, url: "/?start=1", tag: "daily" }),
          // A reminder that shows up hours late is worse than none.
          { TTL: 4 * 3600, urgency: "normal" },
        );
      } catch (err) {
        const { statusCode, body } = err as { statusCode?: number; body?: string };
        gone = statusCode === 404 || statusCode === 410;
        console.error("push failed", new URL(device.endpoint).host, statusCode, body ?? err);
      }
    }
    await ctx.runMutation(internal.devices.rearm, { id, gone });
    return null;
  },
});
