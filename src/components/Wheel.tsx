"use client";

import clsx from "clsx";
import { type Naming, pcName } from "@/lib/music";

/** The twelve pitch classes on a clock face, F on top so the learned arc grows from there. */
export function Wheel({
  lit,
  current,
  naming,
  size = 232,
}: {
  lit: number[];
  current?: number;
  naming: Naming;
  size?: number;
}) {
  const r = size / 2 - 22;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {Array.from({ length: 12 }, (_, pc) => {
        const a = ((pc - 5) / 12) * 2 * Math.PI - Math.PI / 2;
        const on = lit.includes(pc);
        return (
          <div
            key={pc}
            className={clsx(
              "absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[13px] font-semibold transition-colors duration-500",
              on ? "bg-accent text-white" : "bg-fill text-muted",
              current === pc && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
            )}
            style={{ left: size / 2 + r * Math.cos(a), top: size / 2 + r * Math.sin(a) }}
          >
            {pcName(pc, naming)}
          </div>
        );
      })}
    </div>
  );
}
