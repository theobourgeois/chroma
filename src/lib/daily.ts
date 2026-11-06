import { coldDue, coldTrials, spotlightDue } from "./ladder";
import { dayKey, type GameId, type State } from "./store";

export type Step = { game: GameId; count: number; name: string };

/**
 * Ladder levels in a daily session: about fifteen minutes. The study's adults
 * averaged 21 hours over eight weeks, so the whole session goes to perfect
 * pitch; the relative-pitch games stay in Train.
 */
export const DAILY_LEVELS = 10;

/** Today's session. Fixed once started, so resuming doesn't reshuffle it. */
export function plan(s: State, key = dayKey()): Step[] {
  const saved = s.days[key]?.plan;
  if (saved) return saved;
  const steps: Step[] = [];
  if (coldDue(s.ladder, s.days[key])) steps.push({ game: "cold", count: coldTrials(s.ladder.stage), name: "From memory" });
  steps.push({ game: "ladder", count: DAILY_LEVELS, name: "Perfect pitch" });
  if (spotlightDue(s.ladder)) steps.push({ game: "spotlight", count: 34, name: "Spotlight" });
  return steps;
}

/** What a check-in opens: the memory check if the day hasn't had one, else a few notes of recall. */
export function checkIn(s: State): Step {
  return coldDue(s.ladder, s.days[dayKey()])
    ? { game: "cold", count: coldTrials(s.ladder.stage), name: "From memory" }
    : { game: "recall", count: 8, name: "Recall" };
}
