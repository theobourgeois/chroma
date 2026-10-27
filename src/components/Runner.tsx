"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Step } from "@/lib/daily";
import { syncReminder } from "@/lib/reminder";
import { dayKey, get, streak, update } from "@/lib/store";
import { LadderRun } from "./LadderRun";
import { Quiz, type Result } from "./Quiz";
import { Sing } from "./Sing";
import { Button, Layer } from "./ui";

/** Plays a list of steps: today's session, or one game from Train. */
export function Runner({ steps, daily, onClose }: { steps: Step[]; daily: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(() => (daily ? Math.min(get().days[dayKey()]?.step ?? 0, steps.length) : 0));
  const [round, setRound] = useState(0);
  const [between, setBetween] = useState(false);
  const [total, setTotal] = useState<Result>({ n: 0, c: 0 });
  const startedAt = useRef(0);

  // Pin today's plan the moment it starts.
  useEffect(() => {
    startedAt.current = Date.now();
    if (daily) update((s) => void ((s.days[dayKey()] ??= { step: 0, done: false, secs: 0, n: 0, c: 0 }).plan ??= steps));
  }, [daily, steps]);

  const finished = (r: Result) => {
    setTotal((t) => ({ n: t.n + r.n, c: t.c + r.c }));
    const secs = Math.round((Date.now() - startedAt.current) / 1000);
    startedAt.current = Date.now();
    const last = idx + 1 >= steps.length;
    update((s) => {
      const day = (s.days[dayKey()] ??= { step: 0, done: false, secs: 0, n: 0, c: 0 });
      day.secs += secs;
      if (daily) {
        day.step = idx + 1;
        if (last) day.done = true;
      }
    });
    if (daily && last) void syncReminder().catch(() => {});
    setIdx(idx + 1);
    setBetween(!last);
  };

  const step = steps[idx];

  return (
    <Layer onClose={onClose}>
      {idx >= steps.length ? (
        <Summary daily={daily} total={total} onClose={onClose} onAgain={daily ? undefined : () => {
          setTotal({ n: 0, c: 0 });
          setIdx(0);
          setRound((r) => r + 1);
        }} />
      ) : between ? (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <div className="text-[15px] font-medium text-muted tabular-nums">
              {idx + 1} of {steps.length}
            </div>
            <div className="text-[34px] font-bold tracking-tight">{step.name}</div>
          </div>
          <div className="flex flex-col gap-1 px-5 pb-6">
            <Button className="w-full" onClick={() => setBetween(false)}>
              Start
            </Button>
            <Button kind="plain" onClick={onClose}>
              Later
            </Button>
          </div>
        </div>
      ) : step.game === "ladder" ? (
        <LadderRun key={`${idx}-${round}`} levels={daily ? step.count : Infinity} onDone={finished} onClose={onClose} />
      ) : step.game === "sing" ? (
        <Sing key={`${idx}-${round}`} count={step.count} onDone={finished} onClose={onClose} />
      ) : (
        <Quiz key={`${idx}-${round}`} gameId={step.game} count={step.count} onDone={finished} onClose={onClose} />
      )}
    </Layer>
  );
}

function Summary({
  daily,
  total,
  onClose,
  onAgain,
}: {
  daily: boolean;
  total: Result;
  onClose: () => void;
  onAgain?: () => void;
}) {
  const days = get().days;
  const n = streak(days);
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        {daily ? (
          <>
            <div className="pop-in grid size-[96px] place-items-center rounded-full bg-accent text-white">
              <Check size={48} strokeWidth={2.6} />
            </div>
            <div className="mt-4 text-[34px] font-bold tracking-tight">Day {n}</div>
          </>
        ) : (
          <div className="text-[64px] font-bold tracking-tight tabular-nums">
            {total.n ? Math.round((total.c / total.n) * 100) : 0}%
          </div>
        )}
        <div className="text-[17px] text-muted tabular-nums">
          {total.c} of {total.n} right
        </div>
      </div>
      <div className="flex flex-col gap-1 px-5 pb-6">
        {onAgain && (
          <Button className="w-full" onClick={onAgain}>
            Again
          </Button>
        )}
        <Button className="w-full" kind={onAgain ? "plain" : "primary"} onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
