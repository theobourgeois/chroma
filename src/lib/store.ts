"use client";

import { useSyncExternalStore } from "react";
import type { Sound } from "./audio";
import type { Step } from "./daily";
import type { Naming } from "./music";

/** Everything the app remembers, kept on this device. */

export type GameId =
  | "ladder"
  | "spotlight"
  | "notes"
  | "intervals"
  | "chords"
  | "progressions"
  | "scales"
  | "keys"
  | "sing";

export type Settings = {
  naming: Naming;
  sound: Sound;
  remind: boolean;
  /** "HH:MM", local time. */
  remindAt: string;
  /** Skip gradual unlocking in the ear games. */
  everything: boolean;
};

export type LevelRun = { s: number; l: number; acc: number; rt: number; pass: boolean; at: number };

export type Ladder = {
  /** How many pitches are in training, 1–12. */
  stage: number;
  level: number;
  /** Failed attempts in a row at this level. */
  fails: number;
  /** Levels attempted since the last spotlight drill, and that drill's pitch. */
  sinceSpot: number;
  spot?: number;
  /** Consecutive passes of the very last level, and when the third one landed. */
  finalPasses: number;
  finalAt?: number;
  mastered?: number;
  log: LevelRun[];
};

export type PitchStat = { n: number; c: number; recent: number[]; rt: number };
export type GameStat = { unlocked: number; recent: number[]; n: number; c: number };

export type Day = {
  /** The daily plan, saved when it starts so it can't shift under you. */
  plan?: Step[];
  /** Steps of the daily plan finished so far. */
  step: number;
  done: boolean;
  secs: number;
  n: number;
  c: number;
};

export type State = {
  v: 1;
  settings: Settings;
  ladder: Ladder;
  pitch: PitchStat[];
  games: Partial<Record<GameId, GameStat>>;
  days: Record<string, Day>;
};

const KEY = "chroma:v1";

const fresh = (): State => ({
  v: 1,
  settings: { naming: "sharp", sound: "piano", remind: false, remindAt: "19:00", everything: false },
  ladder: { stage: 1, level: 0, fails: 0, sinceSpot: 0, finalPasses: 0, log: [] },
  pitch: Array.from({ length: 12 }, () => ({ n: 0, c: 0, recent: [], rt: 0 })),
  games: {},
  days: {},
});

let state: State = fresh();
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as State;
      const base = fresh();
      state = { ...base, ...saved, settings: { ...base.settings, ...saved.settings } };
    }
  } catch {}
}

export function get(): State {
  load();
  return state;
}

export function update(fn: (s: State) => void) {
  load();
  const next = structuredClone(state);
  fn(next);
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  for (const l of listeners) l();
}

export function reset() {
  const settings = get().settings;
  update((s) => Object.assign(s, fresh(), { settings }));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const serverState = fresh();

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(get()),
    () => select(serverState),
  );
}

export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/** Local calendar date, "2026-10-27". */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function streak(days: Record<string, Day>): number {
  const d = new Date();
  // Today not done yet doesn't break the streak.
  if (!days[dayKey(d)]?.done) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[dayKey(d)]?.done) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function bestStreak(days: Record<string, Day>): number {
  const keys = Object.keys(days)
    .filter((k) => days[k].done)
    .sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of keys) {
    const d = new Date(`${k}T12:00:00`);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Logs one answer: per-pitch stats plus the day's tally. */
export function record(s: State, correct: boolean, pc?: number, rt?: number) {
  const day = (s.days[dayKey()] ??= { step: 0, done: false, secs: 0, n: 0, c: 0 });
  day.n++;
  if (correct) day.c++;
  if (pc === undefined) return;
  const p = s.pitch[pc];
  p.n++;
  if (correct) p.c++;
  p.recent = [...p.recent, correct ? 1 : 0].slice(-40);
  if (rt && correct) p.rt = p.rt ? p.rt * 0.85 + rt * 0.15 : rt;
}

export const accuracy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
