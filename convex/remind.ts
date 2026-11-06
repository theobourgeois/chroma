"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";

const GENERIC = ["Your daily session is ready.", "Ten minutes for your ears.", "Twelve notes are waiting."];

const CHECK = ["A few notes, from memory.", "Which note is this?", "Thirty seconds for your ears."];

/** Sends one device its daily reminder or one of its check-ins, then books tomorrow's. */
export const fire = internalAction({
  args: { id: v.id("devices"), check: v.optional(v.number()) },
  handler: async (ctx, { id, check }) => {
    const device = await ctx.runQuery(internal.devices.get, { id });
    if (!device) return null;
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
    let gone = false;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) console.warn("VAPID keys are not set; skipping push");
    else {
      webpush.setVapidDetails(VAPID_SUBJECT ?? "mailto:noreply@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      const day = Math.floor(Date.now() / 86_400_000);
      const payload =
        check === undefined
          ? { title: "Chroma", body: device.body ?? GENERIC[day % GENERIC.length], url: "/?start=1", tag: "daily" }
          : { title: "Chroma", body: CHECK[(day + check) % CHECK.length], url: "/?check=1", tag: "check" };
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          JSON.stringify(payload),
          // A reminder that shows up hours late is worse than none.
          { TTL: (check === undefined ? 4 : 1) * 3600, urgency: "normal" },
        );
      } catch (err) {
        const { statusCode, body } = err as { statusCode?: number; body?: string };
        gone = statusCode === 404 || statusCode === 410;
        console.error("push failed", new URL(device.endpoint).host, statusCode, body ?? err);
      }
    }
    await ctx.runMutation(internal.devices.rearm, { id, gone, check });
    return null;
  },
});
