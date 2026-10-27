import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, type MutationCtx } from "./_generated/server";

const DAY = 24 * 3600_000;

/** Replaces the device's pending reminder with one at `nextAt`. */
async function arm(ctx: MutationCtx, device: Doc<"devices">, nextAt: number, body?: string) {
  if (device.job) {
    const job = await ctx.db.system.get(device.job);
    if (job?.state.kind === "pending") await ctx.scheduler.cancel(device.job);
  }
  const job = await ctx.scheduler.runAt(nextAt, internal.remind.fire, { id: device._id });
  await ctx.db.patch(device._id, { nextAt, body, job });
}

/** Called by the app whenever the next reminder time or text changes. */
export const save = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string(), nextAt: v.number(), body: v.string() },
  handler: async (ctx, { endpoint, p256dh, auth, nextAt, body }) => {
    if (!endpoint.startsWith("https://")) return null;
    // Never in the past, never more than two days out.
    nextAt = Math.min(Math.max(nextAt, Date.now() + 60_000), Date.now() + 2 * DAY);
    let device = await ctx.db
      .query("devices")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (device) await ctx.db.patch(device._id, { p256dh, auth });
    else {
      const id = await ctx.db.insert("devices", { endpoint, p256dh, auth, nextAt });
      device = (await ctx.db.get(id))!;
    }
    await arm(ctx, device, nextAt, body.slice(0, 160));
    return null;
  },
});

export const remove = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (!device) return null;
    if (device.job) {
      const job = await ctx.db.system.get(device.job);
      if (job?.state.kind === "pending") await ctx.scheduler.cancel(device.job);
    }
    await ctx.db.delete(device._id);
    return null;
  },
});

export const get = internalQuery({
  args: { id: v.id("devices") },
  handler: (ctx, { id }) => ctx.db.get(id),
});

/** After a reminder: the same time tomorrow, or drop a device the push service says is gone. */
export const rearm = internalMutation({
  args: { id: v.id("devices"), gone: v.boolean() },
  handler: async (ctx, { id, gone }) => {
    const device = await ctx.db.get(id);
    if (!device) return null;
    if (gone) {
      await ctx.db.delete(id);
      return null;
    }
    let next = device.nextAt;
    while (next <= Date.now() + 60_000) next += DAY;
    await arm(ctx, { ...device, job: undefined }, next, undefined);
    return null;
  },
});

export type DeviceId = Id<"devices">;
