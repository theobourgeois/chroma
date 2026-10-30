import type { Sound, Tone } from "./audio";
import { ORDER, outOfBounds, trained } from "./ladder";
import {
  cadence,
  CHORDS,
  INTERVALS,
  type Item,
  midiOf,
  type Naming,
  pcName,
  pick,
  PROGRESSIONS,
  rand,
  SCALES,
  voiceProgression,
} from "./music";
import type { GameId, State } from "./store";

/** One question: what to play, and which option is right. */
export type Question = {
  answer: string;
  tones: Tone[];
  /** Pitch class being named, for the per-pitch stats. */
  pc?: number;
  /** Shown on the play button when the prompt is a name rather than a sound. */
  prompt?: string;
};

export type Game = {
  id: GameId;
  name: string;
  /** "pad" answers on a keyboard (option ids are pitch classes). */
  layout: "pad" | "grid" | "binary";
  /** Ordered easiest first; a game unlocks them as you get them right. */
  items: (s: State) => Item[];
  start: number;
  make: (pool: Item[], s: State, prev?: Question) => Question;
  /** Fixed sound, ignoring the setting. */
  sound?: Sound;
};

const note = (pc: number) => ({ id: String(pc), name: "" });
const pcs = (list: number[]) => list.map(note);

/** At least three pitches: the ladder's set when it's bigger. */
const learned = (s: State) => {
  const set = trained(Math.max(3, s.ladder.stage));
  return [...set].sort((a, b) => a - b);
};

/** Root notes stay in a comfortable middle register. */
const root = (lo = 48, hi = 64) => lo + rand(hi - lo + 1);

export const GAMES: Record<Exclude<GameId, "ladder" | "cold" | "sing">, Game> = {
  notes: {
    id: "notes",
    name: "Notes",
    layout: "pad",
    items: (s) => pcs(learned(s)),
    start: 99,
    // Any timbre, five octaves: generalizes what the ladder taught on one instrument.
    sound: "mixed",
    make: (pool, _s, prev) => {
      let pc: number;
      do pc = Number(pick(pool).id);
      while (pool.length > 1 && prev && Number(prev.answer) === pc);
      const midi = midiOf(pc, 2 + rand(5));
      return { answer: String(pc), pc, tones: [{ midi, dur: 1.2 }] };
    },
  },
  intervals: {
    id: "intervals",
    name: "Intervals",
    layout: "grid",
    items: () => INTERVALS,
    start: 3,
    make: (pool) => {
      const it = pick(pool) as (typeof INTERVALS)[number];
      const r = root(48, 72 - it.semis);
      const mode = rand(3);
      const tones: Tone[] =
        mode === 2
          ? [
              { midi: r, dur: 1.6 },
              { midi: r + it.semis, dur: 1.6 },
            ]
          : mode === 0
            ? [
                { midi: r, dur: 0.9 },
                { midi: r + it.semis, at: 0.8, dur: 1.1 },
              ]
            : [
                { midi: r + it.semis, dur: 0.9 },
                { midi: r, at: 0.8, dur: 1.1 },
              ];
      return { answer: it.id, tones };
    },
  },
  chords: {
    id: "chords",
    name: "Chords",
    layout: "grid",
    items: () => CHORDS,
    start: 2,
    make: (pool) => {
      const ch = pick(pool) as (typeof CHORDS)[number];
      const r = root(48, 60);
      const tones: Tone[] = ch.tones.map((t) => ({ midi: r + t, dur: 1.8, gain: 0.75 }));
      tones.push({ midi: r - 12, dur: 1.8, gain: 0.6 });
      return { answer: ch.id, tones };
    },
  },
  progressions: {
    id: "progressions",
    name: "Progressions",
    layout: "grid",
    items: () => PROGRESSIONS,
    start: 2,
    make: (pool) => {
      const pr = pick(pool) as (typeof PROGRESSIONS)[number];
      const chords = voiceProgression(rand(12), pr.chords);
      const tones = chords.flatMap((ch, i) =>
        ch.map((midi, j) => ({ midi, at: i * 0.9, dur: 0.95, gain: j === 0 ? 0.6 : 0.55 })),
      );
      return { answer: pr.id, tones };
    },
  },
  scales: {
    id: "scales",
    name: "Scales",
    layout: "grid",
    items: () => SCALES,
    start: 2,
    make: (pool) => {
      const sc = pick(pool) as (typeof SCALES)[number];
      const r = root(55, 64);
      const step = sc.steps.length > 9 ? 0.18 : 0.26;
      const tones = sc.steps.map((t, i) => ({ midi: r + t, at: i * step, dur: step + 0.25 }));
      return { answer: sc.id, tones };
    },
  },
  keys: {
    id: "keys",
    name: "Keys",
    layout: "pad",
    // Items are modes: major first, minor once major is solid. Answers are tonics.
    items: () => [
      { id: "major", name: "Major" },
      { id: "minor", name: "Minor" },
    ],
    start: 1,
    make: (pool) => {
      const minor = pick(pool).id === "minor";
      const tonic = 48 + rand(12);
      const chords = cadence(tonic, minor);
      const tones = chords.flatMap((ch, i) =>
        ch.map((midi) => ({ midi, at: i * 0.75, dur: i === 3 ? 1.6 : 0.8, gain: 0.55 })),
      );
      return { answer: String(tonic % 12), pc: tonic % 12, tones };
    },
  },
  spotlight: {
    id: "spotlight",
    name: "Spotlight",
    layout: "binary",
    items: (s) => pcs(trained(s.ladder.stage)),
    start: 99,
    make: (pool, s) => {
      const target = s.ladder.spot ?? weakest(s);
      const others = [...pool.map((p) => Number(p.id)), ...outOfBounds(s.ladder.stage)].filter(
        (pc) => pc !== target,
      );
      const hit = Math.random() < 0.5;
      const pc = hit ? target : pick(others);
      return {
        answer: hit ? "yes" : "no",
        pc,
        tones: [{ midi: midiOf(pc, 3 + rand(3)) }],
      };
    },
  },
};

/** The trained pitch you've been getting wrong most lately. */
export function weakest(s: State): number {
  const set = trained(s.ladder.stage);
  let worst = set[0];
  let worstAcc = Infinity;
  for (const pc of set) {
    const r = s.pitch[pc].recent.slice(-20);
    const acc = r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
    if (acc < worstAcc) [worst, worstAcc] = [pc, acc];
  }
  return worst;
}

/** Labels for the answer buttons. */
export function label(game: Game, id: string, naming: Naming, s: State): string {
  if (game.layout === "binary") return id === "yes" ? pcName(s.ladder.spot ?? weakest(s), naming) : "Other";
  if (game.layout === "pad") return pcName(Number(id), naming);
  return game.items(s).find((i) => i.id === id)?.name ?? id;
}

/** Items in play right now. */
export function pool(game: Game, s: State): Item[] {
  const items = game.items(s);
  const stat = s.games[game.id];
  if (s.settings.everything) return items;
  return items.slice(0, Math.max(game.start, stat?.unlocked ?? 0, 1));
}

/** Pitch classes on the answer keyboard for pad games. */
export function padKeys(game: Game, s: State, p: Item[]): number[] {
  if (game.id === "keys") return ORDER.slice().sort((a, b) => a - b);
  return p.map((i) => Number(i.id));
}

export const UNLOCK_AFTER = 20;
export const UNLOCK_AT = 0.85;
