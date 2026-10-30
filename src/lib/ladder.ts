/**
 * The perfect-pitch ladder, after Wong et al. (2025), "Learning fast and
 * accurate absolute pitch judgment in adulthood" (Psychonomic Bulletin & Review):
 *
 * - Start with one pitch (F) and add neighbours alternately below and above.
 * - Tones a semitone or two outside the set are "out of bounds", so you learn
 *   the names rather than which tone is highest or lowest.
 * - Each pitch count runs a ladder of levels: feedback, then none; looser
 *   accuracy and longer answer windows first, tighter later. 90% on an easy
 *   level jumps ahead.
 * - Three octaves, so you learn the chroma rather than the height.
 * - Close to a semitone counts as wrong, and so does a late answer.
 */

import { pcOf, rand, shuffle } from "./music";
import type { Day, Ladder, LevelRun } from "./store";

/** F, then alternately below and above. */
export const ORDER = [5, 4, 6, 3, 7, 2, 8, 1, 9, 0, 10, 11];

export type Level = { pass: number; feedback: boolean; slack: number };

/** The study used 24 per pitch; eight keep a daily session moving. */
export const LEVELS: Level[] = [
  { pass: 0.5, feedback: true, slack: 2600 },
  { pass: 0.6, feedback: true, slack: 1800 },
  { pass: 0.7, feedback: true, slack: 1100 },
  { pass: 0.8, feedback: true, slack: 500 },
  { pass: 0.8, feedback: false, slack: 500 },
  { pass: 0.9, feedback: true, slack: 0 },
  { pass: 0.9, feedback: false, slack: 0 },
  { pass: 0.9, feedback: false, slack: 0 },
];
/** First level that asks for 90%: where a strong run jumps to, and where a held pitch set keeps practising with feedback. */
const JUMP_TO = 5;
export const TRIALS = 20;
/** Taps are slower than the study's mouse clicks. */
const TOUCH_MS = 250;
export const OCTAVES = [3, 4, 5];
/** Wait before the one-take check of the final level. */
export const FINAL_WAIT = 12 * 3600_000;

/**
 * The memory check: the day's first notes, with nothing played beforehand and
 * no feedback. Levels can be passed on notes you heard a minute ago; this is
 * what shows they lasted overnight, so it alone opens the next pitch.
 */
export const COLD_PASS = 0.8;
/** Checks in a row at COLD_PASS: one good day can be luck. */
export const COLD_STREAK = 2;
/** Long enough to recall a note, too short to work it out from the last one. */
export const COLD_WINDOW = 6000;
/** Twelve, or enough to hear every pitch in training. */
export const coldTrials = (stage: number) => Math.max(12, stage * 2);
/** Only when there's something to remember and nothing has been heard today. */
export const coldDue = (l: Ladder, today?: Day) => l.log.length > 0 && !today?.n;

export function logCold(l: Ladder, day: string, c: number, n: number) {
  l.cold = [...l.cold.filter((r) => r.day !== day), { day, s: l.stage, c, n }].slice(-180);
}

/** Passes in a row with the current pitches. */
export function coldPasses(l: Ladder): number {
  let passes = 0;
  for (let i = l.cold.length - 1; i >= 0; i--) {
    const r = l.cold[i];
    if (r.s !== l.stage || r.c / r.n < COLD_PASS) break;
    passes++;
  }
  return passes;
}

/** The study's windows: 1,183 ms with one pitch, 2,028 ms with all twelve. */
export function windowMs(stage: number, level: number): number {
  const base = 1183 + ((2028 - 1183) * (stage - 1)) / 11;
  return Math.round(base + LEVELS[level].slack + TOUCH_MS);
}

export const trained = (stage: number) => ORDER.slice(0, stage);

/** Distance from F, −6…+5. */
const offset = (pc: number) => ((pc - 5 + 18) % 12) - 6;

export function outOfBounds(stage: number): number[] {
  const set = trained(stage);
  if (set.length >= 12) return [];
  const offs = set.map(offset);
  const lo = Math.min(...offs);
  const hi = Math.max(...offs);
  const out = [hi + 1, hi + 2, lo - 1, lo - 2].map((o) => pcOf(o + 5));
  return [...new Set(out)].filter((pc) => !set.includes(pc));
}

export type Trial = { midi: number; pc: number; outside: boolean };

/** A level's tones: two thirds from the set, the rest out of bounds, never the same pitch twice running. */
export function deck(stage: number, n = TRIALS): Trial[] {
  const set = trained(stage);
  const out = outOfBounds(stage);
  const nOut = out.length ? Math.round(n / 3) : 0;
  const pcs: { pc: number; outside: boolean }[] = [];
  for (let i = 0; i < n - nOut; i++) pcs.push({ pc: set[i % set.length], outside: false });
  for (let i = 0; i < nOut; i++) pcs.push({ pc: out[i % out.length], outside: true });
  for (let tries = 0; tries < 20; tries++) {
    shuffle(pcs);
    if (pcs.every((p, i) => i === 0 || p.pc !== pcs[i - 1].pc)) break;
  }
  return pcs.map((p) => ({ ...p, midi: 12 * (OCTAVES[rand(OCTAVES.length)] + 1) + p.pc }));
}

export const isFinal = (l: Pick<Ladder, "stage" | "level">) => l.stage === 12 && l.level === LEVELS.length - 1;

/** True when the next run of the final level is the one-take check. */
export const finalCheck = (l: Ladder) => isFinal(l) && l.finalPasses >= 3 && !l.mastered;

/** Moves the ladder on after a run. Returns what changed, for the result screen. */
export function advance(
  l: Ladder,
  acc: number,
  rt: number,
): { pass: boolean; newPitch?: number; jumped?: boolean; held?: boolean } {
  const level = LEVELS[l.level];
  const pass = acc >= level.pass;
  const run: LevelRun = { s: l.stage, l: l.level, acc, rt, pass, at: Date.now() };
  l.log = [...l.log, run].slice(-600);
  l.sinceSpot++;

  if (isFinal(l)) {
    if (!pass) {
      l.finalPasses = 0;
      l.finalAt = undefined;
    } else if (l.finalPasses >= 3 && l.finalAt && Date.now() - l.finalAt >= FINAL_WAIT) {
      l.mastered ??= Date.now();
    } else if (l.finalPasses < 3) {
      l.finalPasses++;
      if (l.finalPasses === 3) l.finalAt = Date.now();
    }
    return { pass };
  }

  if (!pass) {
    l.fails++;
    return { pass };
  }
  l.fails = 0;
  if (l.level === LEVELS.length - 1) {
    if (coldPasses(l) < COLD_STREAK) {
      l.level = JUMP_TO;
      return { pass, held: true };
    }
    l.stage++;
    l.level = 0;
    return { pass, newPitch: ORDER[l.stage - 1] };
  }
  if (acc >= 0.9 && l.level < JUMP_TO) {
    const jumped = l.level + 1 < JUMP_TO;
    l.level = JUMP_TO;
    return { pass, jumped };
  }
  l.level++;
  return { pass };
}

/** After many misses in a row, step down a level to rebuild. */
export function stepBack(l: Ladder) {
  if (l.level > 0) l.level--;
  l.fails = 0;
}

/** Spotlight drills start at five pitches and come every 15 levels. */
export const spotlightDue = (l: Ladder) => l.stage >= 5 && l.sinceSpot >= 15;
