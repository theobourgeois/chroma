import { coldDue, coldTrials, spotlightDue } from "./ladder";
import { dayKey, type GameId, type State } from "./store";

export type Step = { game: GameId; count: number; name: string };

/** Ear skills that support absolute pitch, one per day in rotation. */
const RELATIVE: { game: GameId; name: string }[] = [
  { game: "intervals", name: "Intervals" },
  { game: "chords", name: "Chords" },
  { game: "progressions", name: "Progressions" },
  { game: "scales", name: "Scales" },
];
/** Absolute pitch used in the wild: other timbres, keys, your own voice. */
const APPLIED: { game: GameId; name: string }[] = [
  { game: "keys", name: "Keys" },
  { game: "notes", name: "Notes" },
  { game: "sing", name: "Sing" },
];

/** Ladder levels in a daily session: about six minutes. */
export const DAILY_LEVELS = 5;

function dayIndex(key: string) {
  return Math.floor(new Date(`${key}T12:00:00`).getTime() / 864e5);
}

/** Today's session. Fixed once started, so resuming doesn't reshuffle it. */
export function plan(s: State, key = dayKey()): Step[] {
  const saved = s.days[key]?.plan;
  if (saved) return saved;
  const i = dayIndex(key);
  const steps: Step[] = [];
  if (coldDue(s.ladder, s.days[key])) steps.push({ game: "cold", count: coldTrials(s.ladder.stage), name: "From memory" });
  steps.push({ game: "ladder", count: DAILY_LEVELS, name: "Perfect pitch" });
  if (spotlightDue(s.ladder)) steps.push({ game: "spotlight", count: 34, name: "Spotlight" });
  const rel = RELATIVE[i % RELATIVE.length];
  const app = APPLIED[i % APPLIED.length];
  steps.push({ ...rel, count: 12 }, { ...app, count: 10 });
  return steps;
}
