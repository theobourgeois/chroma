"use client";

import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { unlock } from "@/lib/audio";
import type { Step } from "@/lib/daily";
import { GAMES, pool } from "@/lib/games";
import { LEVELS } from "@/lib/ladder";
import { accuracy, type GameId, type State, useStore } from "@/lib/store";

type Row = { game: GameId; name: string; count: number };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Perfect pitch",
    rows: [
      { game: "ladder", name: "Ladder", count: 1 },
      { game: "spotlight", name: "Spotlight", count: 34 },
      { game: "notes", name: "Notes", count: 20 },
      { game: "sing", name: "Sing", count: 10 },
    ],
  },
  {
    title: "Ear",
    rows: [
      { game: "intervals", name: "Intervals", count: 20 },
      { game: "chords", name: "Chords", count: 20 },
      { game: "progressions", name: "Progressions", count: 12 },
      { game: "scales", name: "Scales", count: 12 },
      { game: "keys", name: "Keys", count: 12 },
    ],
  },
];

function detail(row: Row, s: State): string {
  if (row.game === "ladder") return `${s.ladder.stage}/12 · L${s.ladder.level + 1}/${LEVELS.length}`;
  if (row.game === "sing" || row.game === "spotlight") {
    const r = s.games[row.game]?.recent ?? [];
    return r.length ? `${Math.round(accuracy(r) * 100)}%` : "";
  }
  const game = GAMES[row.game];
  return `${pool(game, s).length}/${game.items(s).length}`;
}

export function Train({ onStart }: { onStart: (steps: Step[], daily: boolean) => void }) {
  const s = useStore((x) => x);
  return (
    <div className="flex flex-col gap-7 px-5 pt-2 pb-8">
      {SECTIONS.map((sec) => (
        <section key={sec.title}>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{sec.title}</h2>
          <div className="overflow-hidden rounded-[18px] bg-fill">
            {sec.rows.map((row, i) => {
              const locked = row.game === "spotlight" && s.ladder.stage < 2;
              return (
                <button
                  key={row.game}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    unlock();
                    onStart([{ game: row.game, count: row.count, name: row.name }], false);
                  }}
                  className={clsx(
                    "flex h-[54px] w-full items-center gap-3 px-4 text-left transition active:bg-line disabled:opacity-40",
                    i > 0 && "border-t-[0.5px] border-line",
                  )}
                >
                  <span className="flex-1 text-[17px] font-medium">{row.name}</span>
                  <span className="text-[15px] text-muted tabular-nums">{detail(row, s)}</span>
                  <ChevronRight size={18} className="text-muted" />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
