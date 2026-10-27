"use client";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { plan } from "./daily";
import { currentPushState, subscribePush, subscriptionKeys } from "./push";
import { dayKey, get, streak, update } from "./store";

const SYNCED = "chroma:reminder";
let client: ConvexHttpClient | null = null;
const convex = () => (client ??= new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!));

/** The next reminder: today at the set time if today's session isn't done and it's still ahead, else tomorrow. */
function nextAt(at: string, doneToday: boolean): number {
  const [h, m] = at.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (doneToday || d.getTime() <= Date.now() + 60_000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function message(): string {
  const s = get();
  const today = s.days[dayKey()];
  const n = streak(s.days) + (today?.done ? 1 : 0);
  // Tomorrow's plan if today is done; otherwise today's.
  const when = new Date();
  if (today?.done) when.setDate(when.getDate() + 1);
  const games = plan(s, dayKey(when))
    .map((p) => p.name)
    .join(" · ");
  return n > 0 ? `Day ${n + 1} · ${games}` : games;
}

/** Tells the server when and what to send next. Cheap to call: skips if nothing changed. */
export async function syncReminder() {
  const s = get();
  if (!s.settings.remind) return;
  const { state, subscription } = await currentPushState();
  if (state !== "on" || !subscription) return;
  const keys = subscriptionKeys(subscription);
  const at = nextAt(s.settings.remindAt, !!s.days[dayKey()]?.done);
  const body = message();
  const sig = `${keys.endpoint}|${at}|${body}`;
  if (localStorage.getItem(SYNCED) === sig) return;
  await convex().mutation(api.devices.save, { ...keys, nextAt: at, body });
  localStorage.setItem(SYNCED, sig);
}

/** Turns reminders on (asking for permission) or off. Returns the resulting state. */
export async function setReminders(on: boolean): Promise<boolean> {
  if (on) {
    const sub = (await currentPushState()).subscription ?? (await subscribePush());
    if (!sub) return false;
    update((s) => void (s.settings.remind = true));
    localStorage.removeItem(SYNCED);
    await syncReminder();
    return true;
  }
  update((s) => void (s.settings.remind = false));
  localStorage.removeItem(SYNCED);
  const { subscription } = await currentPushState();
  if (subscription) {
    await convex().mutation(api.devices.remove, { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }
  return false;
}
