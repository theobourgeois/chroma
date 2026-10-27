"use client";

import clsx from "clsx";
import { trained } from "@/lib/ladder";
import { pcName } from "@/lib/music";
import { accuracy, bestStreak, dayKey, type GameId, streak, useStore } from "@/lib/store";

const WEEKS = 18;

const GAME_NAMES: [GameId, string][] = [
  ["spotlight", "Spotlight"],
  ["notes", "Notes"],
  ["sing", "Sing"],
  ["intervals", "Intervals"],
  ["chords", "Chords"],
  ["progressions", "Progressions"],
  ["scales", "Scales"],
  ["keys", "Keys"],
];

export function Progress() {
  const s = useStore((x) => x);
  const minutes = Math.round(Object.values(s.days).reduce((a, d) => a + d.secs, 0) / 60);
  const set = trained(s.ladder.stage);
  const runs = s.ladder.log.slice(-40);
  const games = GAME_NAMES.filter(([id]) => s.games[id]?.n);

  return (
    <div className="flex flex-col gap-7 px-5 pt-2 pb-8">
      <div className="grid grid-cols-3 gap-2">
        <Stat value={streak(s.days)} label="Streak" />
        <Stat value={bestStreak(s.days)} label="Best" />
        <Stat value={minutes} label="Minutes" />
      </div>

      <Section title="Days">
        <Calendar days={s.days} />
      </Section>

      <Section title="Pitches">
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: 12 }, (_, pc) => {
            const r = s.pitch[pc].recent;
            const on = set.includes(pc);
            const acc = accuracy(r);
            return (
              <div key={pc} className={clsx("flex flex-col items-center gap-1.5", !on && "opacity-35")}>
                <div className="relative h-24 w-full overflow-hidden rounded-[6px] bg-fill">
                  <div
                    className="absolute inset-x-0 bottom-0 bg-accent transition-[height] duration-500"
                    style={{ height: `${r.length ? acc * 100 : 0}%` }}
                  />
                </div>
                <div className="text-[11px] font-semibold text-muted">{pcName(pc, s.settings.naming)}</div>
              </div>
            );
          })}
        </div>
      </Section>

      {runs.length > 0 && (
        <Section title="Ladder" right={`${s.ladder.log.length} levels`}>
          <div className="flex h-20 items-end gap-[3px]">
            {runs.map((r, i) => (
              <div
                key={i}
                title={`${r.s} pitches · level ${r.l + 1} · ${Math.round(r.acc * 100)}%`}
                className={clsx("min-w-0 flex-1 rounded-[3px]", r.pass ? "bg-accent" : "bg-line")}
                style={{ height: `${Math.max(6, r.acc * 100)}%` }}
              />
            ))}
          </div>
        </Section>
      )}

      {games.length > 0 && (
        <Section title="Games">
          <div className="overflow-hidden rounded-[18px] bg-fill">
            {games.map(([id, name], i) => {
              const g = s.games[id]!;
              return (
                <div
                  key={id}
                  className={clsx("flex h-[50px] items-center px-4", i > 0 && "border-t-[0.5px] border-line")}
                >
                  <span className="flex-1 text-[17px] font-medium">{name}</span>
                  <span className="text-[15px] text-muted tabular-nums">
                    {Math.round((g.c / g.n) * 100)}% · {g.n}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[18px] bg-fill px-4 py-3.5">
      <div className="text-[28px] leading-tight font-bold tabular-nums">{value}</div>
      <div className="text-[13px] font-medium text-muted">{label}</div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
        {right && <span className="text-[13px] text-muted tabular-nums">{right}</span>}
      </div>
      {children}
    </section>
  );
}

/** Weeks as columns, Monday on top, today bottom-right. */
function Calendar({ days }: { days: Record<string, { done: boolean; n: number }> }) {
  const today = new Date();
  const todayKey = dayKey(today);
  const offset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - offset - (WEEKS - 1) * 7);
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
      {cells.map((d) => {
        const k = dayKey(d);
        const day = days[k];
        const future = d > today && k !== todayKey;
        return (
          <div
            key={k}
            className={clsx(
              "aspect-square rounded-[3px]",
              future ? "bg-transparent" : day?.done ? "bg-accent" : day?.n ? "bg-accent/35" : "bg-fill",
              k === todayKey && "ring-1 ring-fg/40",
            )}
          />
        );
      })}
    </div>
  );
}
