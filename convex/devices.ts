import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, type MutationCtx } from "./_generated/server";

const DAY = 24 * 3600_000;

async function cancel(ctx: MutationCtx, id: Id<"_scheduled_functions">) {
  const job = await ctx.db.system.get(id);
  if (job?.state.kind === "pending") await ctx.scheduler.cancel(id);
}

/** Replaces the device's pending reminder with one at `nextAt`. */
async function arm(ctx: MutationCtx, device: Doc<"devices">, nextAt: number, body?: string) {
  if (device.job) await cancel(ctx, device.job);
  const job = await ctx.scheduler.runAt(nextAt, internal.remind.fire, { id: device._id });
  await ctx.db.patch(device._id, { nextAt, body, job });
}

/** Never in the past, never more than two days out. */
const clamp = (at: number) => Math.min(Math.max(at, Date.now() + 60_000), Date.now() + 2 * DAY);

/** Replaces the device's check-ins with ones at these times; each repeats daily. */
async function armChecks(ctx: MutationCtx, device: Doc<"devices">, times: number[]) {
  for (const c of device.checks ?? []) await cancel(ctx, c.job);
  const checks = [];
  for (const [i, raw] of times.slice(0, 4).entries()) {
    const at = clamp(raw);
    checks.push({ at, job: await ctx.scheduler.runAt(at, internal.remind.fire, { id: device._id, check: i }) });
  }
  await ctx.db.patch(device._id, { checks });
}

/** Called by the app whenever the next reminder time or text changes. */
export const save = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    nextAt: v.number(),
    body: v.string(),
    checks: v.optional(v.array(v.number())),
  },
  handler: async (ctx, { endpoint, p256dh, auth, nextAt, body, checks }) => {
    if (!endpoint.startsWith("https://")) return null;
    nextAt = clamp(nextAt);
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
    if (checks) await armChecks(ctx, (await ctx.db.get(device._id))!, checks);
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
    if (device.job) await cancel(ctx, device.job);
    for (const c of device.checks ?? []) await cancel(ctx, c.job);
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
  args: { id: v.id("devices"), gone: v.boolean(), check: v.optional(v.number()) },
  handler: async (ctx, { id, gone, check }) => {
    const device = await ctx.db.get(id);
    if (!device) return null;
    if (gone) {
      if (device.job) await cancel(ctx, device.job);
      for (const c of device.checks ?? []) await cancel(ctx, c.job);
      await ctx.db.delete(id);
      return null;
    }
    if (check !== undefined) {
      const checks = [...(device.checks ?? [])];
      const c = checks[check];
      if (!c) return null;
      let at = c.at;
      while (at <= Date.now() + 60_000) at += DAY;
      checks[check] = { at, job: await ctx.scheduler.runAt(at, internal.remind.fire, { id, check }) };
      await ctx.db.patch(id, { checks });
      return null;
    }
    let next = device.nextAt;
    while (next <= Date.now() + 60_000) next += DAY;
    await arm(ctx, { ...device, job: undefined }, next, undefined);
    return null;
  },
});

export type DeviceId = Id<"devices">;
