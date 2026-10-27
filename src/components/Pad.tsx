"use client";

import clsx from "clsx";
import { type Naming, pcName } from "@/lib/music";

export type Mark = "right" | "wrong" | "answer";

const WHITE = [0, 2, 4, 5, 7, 9, 11];
/** Black key → the white-key boundary it sits on. */
const BLACK: [number, number][] = [
  [1, 1],
  [3, 2],
  [6, 4],
  [8, 5],
  [10, 6],
];

/**
 * The answer keyboard. Fires on pointer down: answer time is part of the
 * score, and waiting for the click would add a few dozen milliseconds.
 */
export function Pad({
  enabled,
  naming,
  marks,
  onPick,
  locked,
}: {
  enabled: number[];
  naming: Naming;
  marks: Partial<Record<number, Mark>>;
  /** `at` is the tap's timestamp, on the performance.now() clock. */
  onPick: (pc: number, at: number) => void;
  locked?: boolean;
}) {
  const key = (pc: number, black: boolean) => {
    const on = enabled.includes(pc);
    const mark = marks[pc];
    return {
      disabled: !on,
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        if (on && !locked) onPick(pc, e.timeStamp);
      },
      className: clsx(
        "flex items-end justify-center pb-3 text-[14px] font-semibold transition-colors duration-150 select-none",
        black
          ? "absolute top-0 h-[58%] w-[11%] -translate-x-1/2 rounded-b-[10px] text-white"
          : "relative h-full flex-1 rounded-b-[12px] border-x-[0.5px] border-b border-line",
        black && !mark && (on ? "bg-[#1d1d1f] active:bg-[#3a3a3c] dark:bg-[#3a3a3c]" : "bg-[#1d1d1f]/25 dark:bg-[#3a3a3c]/40"),
        !black && !mark && (on ? "bg-white text-[#1d1d1f] active:bg-[#f0f0f2] dark:bg-[#e5e5ea]" : "bg-white/50 text-[#1d1d1f]/20 dark:bg-[#e5e5ea]/20 dark:text-white/20"),
        mark === "right" && "!bg-good text-white",
        mark === "wrong" && "!bg-bad text-white",
        mark === "answer" && "!bg-accent text-white",
      ),
    };
  };
  return (
    <div className="no-callout relative flex h-[188px] w-full touch-none overflow-hidden rounded-[14px] bg-line">
      {WHITE.map((pc) => (
        <button key={pc} type="button" {...key(pc, false)}>
          {enabled.includes(pc) || marks[pc] ? pcName(pc, naming) : ""}
        </button>
      ))}
      {BLACK.map(([pc, at]) => (
        <button key={pc} type="button" style={{ left: `${(at * 100) / 7}%` }} {...key(pc, true)}>
          <span className="text-[11px]">{enabled.includes(pc) || marks[pc] ? pcName(pc, naming) : ""}</span>
        </button>
      ))}
    </div>
  );
}
